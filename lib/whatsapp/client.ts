/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/rules-of-hooks */

// Tell ws to skip the native bufferutil addon (can be broken in some environments)
process.env.WS_NO_BUFFER_UTIL = "1";

import makeWASocket, {
  BufferJSON,
  initAuthCreds,
  fetchLatestWaWebVersion,
} from "@whiskeysockets/baileys";
import pino from "pino";
import path from "path";
import fs from "fs";
import { saveConnection, disconnectConnection } from "@/lib/integrations/actions-core";
import { decideWaCloseAction, decidePairingClose, decidePairingRenewal } from "@/lib/whatsapp/disconnect-policy";
import { WhatsAppSessionsRepository } from "@/lib/repositories/whatsapp-sessions-repository";
import { IntegrationsRepository } from "@/lib/repositories/integrations-repository";
import { createAdminDb } from "@/lib/db";

// In-memory cache of active Baileys socket connections
const activeSockets = new Map<string, any>();

// Per-user in-flight getClient() promise. Guarantees a single live socket per
// user even under concurrent calls (double-triggered reconnects, dashboard
// polls + briefing generation + connection-status checks racing).
const clientLocks = new Map<string, Promise<any>>();

// In-memory state for an in-progress pairing session (not yet linked)
const pairingSessions = new Map<string, PairingState>();

interface PairingState {
  sock: any;
  // QR flow
  latestQR: string | null;
  /** Absolute expiry of the CURRENT qr (Date.now() + WA_QR_TTL_MS). Baileys
   * re-emits a fresh QR on the same socket every qrTimeout, so this advances
   * automatically. The frontend countdown derives from this — never a local
   * hardcoded TTL. */
  qrExpiresAt: number | null;
  // Pairing code flow
  code: string | null;
  codeExpiresAt: number | null;
  // Shared
  connected: boolean;
  /** True once the phone approved the QR/code. NOT a verified session yet. */
  paired: boolean;
  /** Whether the pairing socket is still alive (not closed/ended). Renewal must
   * NEVER replace a live socket — a scan at second 59 may be mid-authorization
   * on that exact socket, and Baileys re-emits fresh QRs on it automatically. */
  sockAlive: boolean;
  phone: string;
  method: "qr" | "code";
}

const sessionsRepo = new WhatsAppSessionsRepository();

// One initial sync per user per process, kicked right after the first verified open.
const initialSyncDone = new Set<string>();

// Cached "socket has reported open" per user. Flips true on `open`, cleared on
// `close`. Used to distinguish a live verified socket from one that only exists
// in activeSockets while still (re)connecting.
const socketOpen = new Set<string>();

// Lazy socket-restore dedupe: probes from briefing/dashboard/maintenance that
// race while a stale socket is being re-established each only fire one getClient.
const restoring = new Set<string>();

/**
 * CQ: single source of truth for the QR lifetime. Baileys re-emits a fresh QR
 * on the SAME socket every QR_TIMEOUT_MS (it regenerates the ref, it does not
 * close the connection), so one socket survives the full 60s window. The
 * frontend countdown and the socket TTL must both derive from this constant —
 * a mismatch is exactly what made the QR "expire" in ~20s.
 */
export const WA_QR_TTL_MS = 60_000;

export interface WhatsAppConnectionState {
  authOk: boolean;       // session creds persisted AND integration row is active
  socketOpen: boolean;   // live socket has reported `open` this process
  sessionValid: boolean; // socket identity present (not logged out)
  initialSyncDone: boolean;
  lastSyncOk: boolean;   // persisted sync_status === "success"
  ready: boolean;        // all of the above
}

// Shared Baileys socket options. Every socket (restored, QR, pairing code)
// must use these — the defaults let the noise handshake stall on a freshly
// paired session and the "open" event never fires (stuck in connecting).
// Ref: getClient restore path previously omitted these and hung.
function waSocketConfig(waVersion: any, overrides: Record<string, unknown> = {}) {
  return {
    logger: pino({ level: "silent" }) as any,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    connectTimeoutMs: 100000,
    keepAliveIntervalMs: 45000,
    retryRequestDelayMs: 500,
    waWebSocketUrl: "wss://web.whatsapp.com/ws/chat",
    version: waVersion,
    ...overrides,
  };
}

// Structured auth-lifecycle trace. Timestamped so the QR→scan→pair timeline
// can be reconstructed from server logs to confirm where time is lost.
function waTrace(userId: string, stage: string, extra: Record<string, unknown> = {}) {
  console.log(
    `[wa-auth] ${Date.now()} userId=${userId} wsActive=${activeSockets.size + pairingSessions.size} stage=${stage}`,
    Object.keys(extra).length ? JSON.stringify(extra) : "",
  );
}

// DB-backed auth state (replacement for useMultiFileAuthState)
async function useDBAuthState(userId: string): Promise<{
  state: { creds: any; keys: { get: (type: string, ids: string[]) => Promise<Record<string, any>>; set: (data: Record<string, Record<string, any>>) => Promise<void> } };
  saveCreds: (newCreds?: any) => Promise<void>;
  flush: () => Promise<void>;
}> {
  let creds: any;
  let keysCache: Record<string, any> = {};
  let saveQueued = false;

  const persist = async () => {
    saveQueued = false;
    if (!creds?.me?.id) return;
    await sessionsRepo.saveSession(userId, {
      creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
      keys: JSON.parse(JSON.stringify(keysCache, BufferJSON.replacer)),
    });
  };

  const queuePersist = () => {
    if (!saveQueued) {
      saveQueued = true;
      setTimeout(persist, 500);
    }
  };

  const existing = await sessionsRepo.getSession(userId);
  if (existing) {
    try {
      creds = existing.creds || initAuthCreds();
      keysCache = existing.keys || {};
    } catch {
      creds = initAuthCreds();
      keysCache = {};
    }
  } else {
    creds = initAuthCreds();
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: Record<string, any> = {};
          for (const id of ids) {
            data[id] = keysCache[`${type}-${id}`] || null;
          }
          return data;
        },
        set: async (data: Record<string, Record<string, any>>) => {
          for (const category in data) {
            for (const id in data[category]) {
              const key = `${category}-${id}`;
              const value = data[category][id];
              if (value) {
                keysCache[key] = value;
              } else {
                delete keysCache[key];
              }
            }
          }
          queuePersist();
        },
      },
    },
    saveCreds: async (newCreds?: any) => {
      if (newCreds) Object.assign(creds, newCreds);
      await persist();
    },
    flush: persist,
  };
}

// JSON file-backed message cache. Loaded into memory once per user, deduped
// by (remoteJid,id), debounced-flushed to disk so history survives restarts
// and reconnects never duplicate incoming messages. Group + DM history both
// land here via Baileys syncFullHistory + fetchMessagesFromSync.
const MESSAGE_CACHE_DIR = path.join(process.cwd(), ".insforge", "whatsapp-cache");
const MAX_CACHED_MESSAGES = 3000;

const messageStore = new Map<string, Map<string, any>>(); // userId -> "remoteJid:id" -> message
const historyActivity = new Map<string, number>();        // userId -> last history upsert (ms)
const flushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const syncCounters = new Map<string, { inserted: number; skipped: number }>(); // per-run tally
const chatIds = new Map<string, Set<string>>();           // userId -> known chat jids (groups + DMs)
const contactIds = new Map<string, Set<string>>();        // userId -> known contact jids

function messageKey(m: any): string | null {
  const jid = m?.from;
  const id = m?.id;
  return jid && id ? `${jid}:${id}` : null;
}

function ensureStore(userId: string): Map<string, any> {
  let store = messageStore.get(userId);
  if (!store) {
    store = new Map();
    const file = path.join(MESSAGE_CACHE_DIR, userId, "messages_cache.json");
    try {
      if (fs.existsSync(file)) {
        const arr = JSON.parse(fs.readFileSync(file, "utf-8"));
        for (const m of Array.isArray(arr) ? arr : []) {
          const key = messageKey(m);
          if (key) store.set(key, m);
        }
      }
    } catch {
      // corrupt/stale cache — start empty, rebuild on next sync
    }
    messageStore.set(userId, store);
  }
  return store;
}

function flushCache(userId: string) {
  flushTimers.delete(userId);
  const store = messageStore.get(userId);
  if (!store) return;
  try {
    const dir = path.join(MESSAGE_CACHE_DIR, userId);
    fs.mkdirSync(dir, { recursive: true });
    const arr = [...store.values()];
    while (arr.length > MAX_CACHED_MESSAGES) arr.pop(); // keep newest
    fs.writeFileSync(path.join(dir, "messages_cache.json"), JSON.stringify(arr, null, 2));
  } catch (e) {
    console.error("Failed to flush WhatsApp message cache:", e);
  }
}

function scheduleFlush(userId: string) {
  const existing = flushTimers.get(userId);
  if (existing) clearTimeout(existing);
  flushTimers.set(userId, setTimeout(() => flushCache(userId), 500));
}

/** Insert or update a message in the cache. Returns "inserted" | "skipped". */
function cacheMessage(userId: string, message: any): "inserted" | "skipped" {
  const store = ensureStore(userId);
  const key = messageKey(message);
  if (!key) return "skipped";
  const wasNew = !store.has(key);
  store.set(key, message);
  historyActivity.set(userId, Date.now());
  while (store.size > MAX_CACHED_MESSAGES) {
    const oldest = store.keys().next().value as string | undefined;
    if (!oldest) break;
    store.delete(oldest);
  }
  scheduleFlush(userId);
  const counters = syncCounters.get(userId) || { inserted: 0, skipped: 0 };
  if (wasNew) counters.inserted += 1;
  else counters.skipped += 1;
  syncCounters.set(userId, counters);
  return wasNew ? "inserted" : "skipped";
}

// ── Durable persistence to the unified store ────────────────────────────────
// The JSON cache is a performance layer that only survives as long as a single
// server process. Messages are ALSO persisted to unified_messages (debounced)
// so they reach the briefing pipeline and survive restarts/reconnects. Dedupe
// is by provider_message_id (message key) so re-upserts are harmless.
const persistQueues = new Map<string, any[]>();              // userId -> pending messages
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();
const persistIntegrationIds = new Map<string, string>();     // userId -> integration row id

function cachePersist(userId: string, message: any) {
  const queue = persistQueues.get(userId) || [];
  queue.push(message);
  persistQueues.set(userId, queue);
  const existing = persistTimers.get(userId);
  if (existing) clearTimeout(existing);
  persistTimers.set(userId, setTimeout(() => { void flushPersist(userId); }, 1200));
}

async function flushPersist(userId: string): Promise<void> {
  persistTimers.delete(userId);
  const queue = persistQueues.get(userId);
  persistQueues.delete(userId);
  if (!queue || queue.length === 0) return;
  try {
    let integrationId = persistIntegrationIds.get(userId);
    if (!integrationId) {
      const record = await new IntegrationsRepository(createAdminDb()).findByUserAndProvider(userId, "whatsapp");
      integrationId = record?.id || "";
    }
    if (!integrationId) {
      // Row not written yet (mid-pairing), or integration gone. Hang onto the
      // messages and retry once the connection row exists (saveConnection is
      // reached after the initial sync completes) instead of dropping them.
      const backlog = persistQueues.get(userId) || [];
      persistQueues.set(userId, [...backlog, ...queue]);
      const existing = persistTimers.get(userId);
      if (existing) clearTimeout(existing);
      persistTimers.set(userId, setTimeout(() => { void flushPersist(userId); }, 2000));
      return;
    }
    persistIntegrationIds.set(userId, integrationId);
    const { normalizeResult } = await import("@/lib/briefing/pipeline");
    const { getUnifiedStoreRepo } = await import("@/lib/repositories/unified-store-repository");
    const entities = normalizeResult("whatsapp", queue, integrationId);
    if (entities.length > 0) {
      await getUnifiedStoreRepo().upsertBatch(userId, integrationId, entities);
    }
  } catch (err) {
    console.warn(`[wa-unified] failed to persist messages for ${userId}:`, err);
  }
}

/** Flush any in-flight persist queue immediately (used on disconnect/shutdown). */
export async function flushPendingPersists(userId: string): Promise<void> {
  await flushPersist(userId);
}

function recordChat(userId: string, jid?: string) {
  if (!jid) return;
  let set = chatIds.get(userId);
  if (!set) {
    set = new Set();
    chatIds.set(userId, set);
  }
  set.add(jid);
}

function recordContact(userId: string, jid?: string) {
  if (!jid) return;
  let set = contactIds.get(userId);
  if (!set) {
    set = new Set();
    contactIds.set(userId, set);
  }
  set.add(jid);
}

/** Wait until history sync goes quiet (no new upserts for `quietMs`) or deadline. */
async function waitForHistorySettle(userId: string, quietMs = 1200, deadlineMs = 25000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    const idle = Date.now() - (historyActivity.get(userId) || start);
    const minElapsed = Date.now() - start >= 800;
    if (minElapsed && idle >= quietMs) return;
    await new Promise(r => setTimeout(r, 250));
  }
}

function computeSyncStats(userId: string): Record<string, unknown> {
  const chats = chatIds.get(userId) || new Set<string>();
  let groups = 0;
  let dms = 0;
  for (const jid of chats) {
    if (jid.endsWith("@g.us")) groups += 1;
    else dms += 1;
  }
  const counters = syncCounters.get(userId) || { inserted: 0, skipped: 0 };
  return {
    chatsSynced: chats.size,
    groupChats: groups,
    dmChats: dms,
    contactsDiscovered: (contactIds.get(userId) || new Set()).size,
    messagesCached: (messageStore.get(userId) || new Map()).size,
    messagesInserted: counters.inserted,
    duplicatesSkipped: counters.skipped,
  };
}

// Shared socket wiring: reconnect/close handling + incoming message
// caching. Applied to every socket (restored sessions and freshly-linked QR
// sockets alike) so both paths get identical behaviour.
function attachClientHandlers(sock: any, userId: string) {
  sock.ev.on("connection.update", async (update: any) => {
    try {
      const { connection, lastDisconnect } = update;

        // Trace every state so hangs (connecting/connecting_lost) are visible.
        if (connection !== "open" && connection !== "close") {
          waTrace(userId, "restore_state", { connection });
        }

        if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const hasSession = await WhatsAppClientManager.isSessionSaved(userId);
        const action = decideWaCloseAction(statusCode, hasSession);

        waTrace(userId, "client_close", { statusCode, hasSession, action });

        // Only the socket currently registered as live may clear state. A stale
        // socket's close must not evict a newer connection for the same user.
        if (activeSockets.get(userId) !== sock) {
          waTrace(userId, "client_close_stale_ignored");
          return;
        }

        activeSockets.delete(userId);
        socketOpen.delete(userId);

        if (action === "teardown_session") {
          // Phone revoked / logged out — the persisted session is truly dead.
          // Tear down the integration row + session so the UI asks to reconnect.
          try { await disconnectConnection(userId, "whatsapp"); } catch (e) {
            console.error("Failed to delete connection on logout:", e);
          }
        } else if (action === "reconnect") {
          // Transient close (network drop, restart, timeout). The persisted
          // session + active integration row are KEPT — this is the durable
          // source of truth. getConnectionState() therefore still reports
          // ready for connected, so the integration never silently vanishes.
          // Reopen the socket in the background to resume live delivery.
          setTimeout(() => {
            WhatsAppClientManager.getClient(userId).catch(err => console.error("Error reconnecting WhatsApp:", err));
          }, 3000);
        }
        // action === "ignore": no session creds yet (pre-pair). Never delete an
        // existing active integration row just because a pairing socket closed.
      } else if (connection === "open") {
        // `open` on a RESTORED/verified socket = a usable session. It does NOT
        // fire on the pre-auth noise handshake of a pairing socket, so this is
        // the only trustworthy point to mark the integration Connected.
        //
        // Ordered lifecycle (see required sequence):
        // SOCKET_OPEN → VERIFY sock.user → SAVE_CREDENTIALS →
        // RUN_INITIAL_SYNC → VERIFY_SYNC_SUCCESS → SAVE_CONNECTION
        // (upsert + NOTIFY_FRONTEND_CONNECTED, published inside
        // saveConnection) → SET pairing.connected.
        // The frontend is never told Connected until sync has fully concluded.
        waTrace(userId, "socket_open");
        // Only the live socket may advance connection state. If a newer socket
        // already replaced this one, ignore — prevents a stale socket's open
        // from marking the user connected or running a duplicate sync.
        if (activeSockets.get(userId) !== sock) {
          waTrace(userId, "socket_open_stale_ignored");
          return;
        }
        socketOpen.add(userId);

        // VERIFY sock.user exists
        const userJid = sock.user?.id ? sock.user.id.split(":")[0] : null;
        if (!userJid) {
          waTrace(userId, "verify_user_failed");
          return;
        }
        waTrace(userId, "verify_user_ok", { jid: userJid });

        // SAVE_CREDENTIALS — already persisted by this point: pairing sockets
        // flush on isNewLogin + creds.update, restored sockets persist on
        // creds.update (wired in getClient). No further write needed.
        waTrace(userId, "save_credentials");

        // RUN_INITIAL_SYNC + VERIFY_SYNC_SUCCESS. Awaited and run BEFORE
        // saveConnection so "Connected" can never be emitted mid-sync. The
        // once-per-process guard prevents a second sync on reconnects.
        // Runs inline (repo, not the cookie-guarded server action) because
        // socket events carry no request context.
        if (!initialSyncDone.has(userId)) {
          initialSyncDone.add(userId);
          const integrationsRepo = new IntegrationsRepository(createAdminDb());
          try {
            waTrace(userId, "run_initial_sync");
            await integrationsRepo.setSyncStatus(userId, "whatsapp", "syncing");
            // syncFullHistory (enabled on this socket) streams the recent
            // chat/message window through chats.set + messages.upsert. Wait for
            // that to go quiet so the snapshot is complete before we count it.
            await waitForHistorySettle(userId);
            // Deepen history: fetch recent messages for every known chat (groups
            // AND direct messages + archived), then let those upserts land too.
            const knownChats = chatIds.get(userId);
            if (knownChats && knownChats.size > 0) {
              try {
                await sock.fetchMessagesFromSync({ jids: [...knownChats], count: 30 }).catch(() => {});
                await waitForHistorySettle(userId, 1000, 10000);
              } catch {}
            }
            await flushCache(userId);
            const stats = computeSyncStats(userId);
            await integrationsRepo.setSyncStatus(userId, "whatsapp", "success");
            await integrationsRepo.addSyncLog({
              user_id: userId,
              provider: "whatsapp",
              status: "success",
              message: "Initial WhatsApp sync completed (full history).",
              metadata: stats,
            });
            waTrace(userId, "verify_sync_success", stats);
          } catch (e) {
            // VERIFY_SYNC_SUCCESS failed — do not advertise Connected and do not
            // leave the once-guard set, so a later socket open retries the sync.
            console.error(`[wa-auth] initial sync failed userId=${userId}`, e);
            initialSyncDone.delete(userId);
            try {
              await integrationsRepo.setSyncStatus(userId, "whatsapp", "error", "Initial sync failed");
            } catch {}
            return;
          }
        }

        // Race guard: the user may have disconnected or started a fresh
        // pairing while the sync ran — never finalize a stale socket.
        if (activeSockets.get(userId) !== sock) {
          waTrace(userId, "finalize_skipped_stale_socket");
          return;
        }

        const formattedJid = `${userJid}@s.whatsapp.net`;

        try {
          // SAVE_CONNECTION (DB upsert) + NOTIFY_FRONTEND_CONNECTED (publishes
          // connection.updated to the SSE stream). Only fired post-sync.
          await saveConnection(
            userId,
            "whatsapp",
            formattedJid,
            `whatsapp_token_${userId}`,
            undefined,
            365 * 24 * 3600
          );
          waTrace(userId, "save_connection");
        } catch (dbErr) {
          console.error("Failed to save WhatsApp connection to DB:", dbErr);
          return;
        }

        // saveConnection created the row; persist the just-verified sync state
        // onto it so sync_status is "success" (not null) after connect.
        try {
          const integrationsRepo = new IntegrationsRepository(createAdminDb());
          await integrationsRepo.setSyncStatus(userId, "whatsapp", "success");
        } catch {}

        // SET pairing.connected = true — frontend status polling flips to
        // Connected.
        const pairing = pairingSessions.get(userId);
        if (pairing) pairing.connected = true;
        waTrace(userId, "connected");
      }
    } catch (handlerErr) {
      console.error(`WhatsApp connection.update handler error for ${userId}:`, handlerErr);
    }
  });

  // Track the chat/contact directory (from history sync and live upserts)
  // so backfill + stats cover every group, DM, archived and new conversation.
  sock.ev.on("chats.set", async ({ chats }: any) => {
    const jids = (chats || []).map((c: any) => c?.id).filter(Boolean) as string[];
    for (const jid of jids) recordChat(userId, jid);
    waTrace(userId, "chats_set", { chatCount: jids.length });
  });
  sock.ev.on("chats.upsert", async (chats: any[]) => {
    for (const c of chats || []) recordChat(userId, c?.id);
  });
  sock.ev.on("contacts.set", async (contacts: any[]) => {
    for (const c of contacts || []) recordContact(userId, c?.id);
  });
  sock.ev.on("contacts.upsert", async (contacts: any[]) => {
    for (const c of contacts || []) recordContact(userId, c?.id);
  });

  // Cache incoming messages. "notify" = live delivery, "append" = history
  // sync / fetchMessagesFromSync. Both carry the same shape; cacheMessage
  // dedupes by remoteJid:id so re-upserts are harmless.
  sock.ev.on("messages.upsert", async (m: any) => {
    if (m.type === "notify" || m.type === "append") {
      for (const msg of m.messages) {
        if (!msg.message) continue;

        const text = msg.message.conversation ||
                     msg.message.extendedTextMessage?.text ||
                     "";
        if (!text) continue;

        const from = msg.key.remoteJid || "";
        const fromMe = msg.key.fromMe || false;
        const name = msg.pushName || "WhatsApp User";
        recordChat(userId, from);

        const cached = {
          id: msg.key.id,
          from,
          fromName: fromMe ? "Me" : name,
          message: text,
          timestamp: new Date(Number(msg.messageTimestamp) * 1000).toISOString(),
          isGroup: from.endsWith("@g.us"),
          senderName: from.endsWith("@g.us") ? name : undefined,
        };
        cacheMessage(userId, cached);
        // Persist durably to unified_messages so the data survives the
        // ephemeral per-process cache and reaches the briefing pipeline.
        cachePersist(userId, cached);
      }
    }
  });
}

export class WhatsAppClientManager {
  /**
   * Initializes or returns a Baileys connection for a user
   */
  public static async getClient(userId: string, forceReconnect = false): Promise<any> {
    if (activeSockets.has(userId) && !forceReconnect) {
      waTrace(userId, "getClient_existing");
      return activeSockets.get(userId);
    }

    // Single-flight: if another caller is already (re)connecting this user,
    // await the same promise instead of creating a second socket.
    if (!forceReconnect) {
      const inflight = clientLocks.get(userId);
      if (inflight) {
        waTrace(userId, "getClient_await_inflight");
        return inflight;
      }
    }

    waTrace(userId, "getClient_fresh", { forceReconnect });
    const promise = (async () => {
      const { state, saveCreds } = await useDBAuthState(userId);

      // Pin the live web version; the bundled default goes stale and WhatsApp
      // kills the session with 405 (client_too_old).
      const { version: waVersion } = await fetchLatestWaWebVersion().catch(() => ({
        version: undefined,
      }));

      const sock = makeWASocket({
        // Full history sync pulls recent groups, DMs, archived chats, contacts
        // and messages on connect — the basis for the complete backfill.
        ...waSocketConfig(waVersion, { syncFullHistory: true }),
        auth: state,
        browser: ["Windows", "Chrome", "20.0.04"],
      });

      sock.ev.on("creds.update", saveCreds);
      attachClientHandlers(sock, userId);

      // Reset per-user sync state on a fresh (re)connect so a reconnect still
      // re-syncs; only the once-per-process initialSyncDone guard stays.
      syncCounters.set(userId, { inserted: 0, skipped: 0 });

      activeSockets.set(userId, sock);
      return sock;
    })().finally(() => {
      clientLocks.delete(userId);
    });

    clientLocks.set(userId, promise);
    return promise;
  }

  /**
   * Request pairing code for WhatsApp Web link
   */
  public static async requestPairingCode(userId: string, phone: string): Promise<{ code: string; expiresAt: number }> {
    const cleanNumber = phone.replace(/\D/g, "");
    if (!cleanNumber || cleanNumber.length < 10) throw new Error("Invalid phone number format.");

    const cleanPairing = () => {
      const existing = pairingSessions.get(userId);
      if (existing) {
        try { existing.sock.end(undefined); } catch {}
        pairingSessions.delete(userId);
      }
      if (activeSockets.has(userId)) {
        try { activeSockets.get(userId).end(undefined); } catch {}
        activeSockets.delete(userId);
        socketOpen.delete(userId);
      }
    };
    cleanPairing();

    await sessionsRepo.deleteSession(userId);
    const { state, saveCreds, flush } = await useDBAuthState(userId);

    const { version: waVersion } = await fetchLatestWaWebVersion().catch(() => ({
      version: undefined,
    }));

    const sock = makeWASocket({
      ...waSocketConfig(waVersion),
      auth: state,
      logger: pino({ level: "debug", name: "baileys-pairing" }) as any,
    });

    const pairing: PairingState = { sock, latestQR: null, qrExpiresAt: null, code: null, codeExpiresAt: null, connected: false, paired: false, sockAlive: true, phone, method: "code" };
    pairingSessions.set(userId, pairing);
    waTrace(userId, "socket_created");

    // creds.update fires on pair-success. Merge + persist immediately so
    // isSessionSaved() is true before the close handler checks it.
    sock.ev.on("creds.update", async (credsPayload: any) => {
      try {
        await saveCreds(credsPayload);
        if (credsPayload?.me?.id && !pairing.paired) {
          pairing.paired = true;
          waTrace(userId, "code_creds_me_id");
        }
        waTrace(userId, "creds_saved");
      } catch (e) {
        console.error(`[wa-auth] creds.save FAILED userId=${userId}`, e);
      }
    });

    sock.ev.on("connection.update", async (update: any) => {
      try {
        const code = (update.lastDisconnect?.error as any)?.output?.statusCode;
        waTrace(userId, "connection_update", {
          connection: update.connection,
          isNewLogin: update.isNewLogin,
          hasQR: !!update.qr,
          disconnectCode: code,
        });

        // ── Pair-success: phone authorized the code ──
        if (update.isNewLogin) {
          if (!pairing.paired) {
            pairing.paired = true;
            waTrace(userId, "phone_authorized");
            // Flush creds to DB NOW. Pairing socket is NOT a verified session —
            // Connected is only set once a restored socket reaches `open`.
            try {
              await flush();
              waTrace(userId, "creds_flushed");
            } catch (e) {
              console.error(`[wa-auth] flush FAILED userId=${userId}`, e);
            }
          }
        }

        // Socket closed ──
        if (update.connection === "close") {
          waTrace(userId, "closed", { statusCode: code, paired: pairing.paired, connected: pairing.connected });
          activeSockets.delete(userId);
          socketOpen.delete(userId);
          if (pairing.paired) {
            // Phone authorized; server usually closes (515) after pair-success.
            // Reconnect on a fresh socket — its `open` handler (attachClientHandlers)
            // verifies the persisted session and only then marks Connected.
            waTrace(userId, "validating_session");
            waTrace(userId, "reconnecting_after_pair");
            setTimeout(() => {
              WhatsAppClientManager.getClient(userId)
                .then(() => waTrace(userId, "reconnected"))
                .catch((e) => console.error(`[wa-auth] reconnect FAILED userId=${userId}`, e));
            }, 1000);
          } else {
            // Pre-auth close. Only a genuine 401 (phone revoked) tears down; any
            // transient close keeps the pairing + session so the user can renew
            // without re-linking (mirrors the QR path + shared pairing policy).
            const action = decidePairingClose(code, pairing.paired);
            if (action === "teardown_session") {
              pairingSessions.delete(userId);
              try { await sessionsRepo.deleteSession(userId); } catch {}
              try { await disconnectConnection(userId, "whatsapp"); } catch (e) {
                console.error("Failed to delete connection on code logout:", e);
              }
            } else {
              waTrace(userId, "code_kept_on_transient_close", { statusCode: code, action });
            }
          }
        }
      } catch (e) {
        console.error(`WhatsApp pairing connection.update handler error for ${userId}:`, e);
      }
    });

    // Wait for socket ready (noise handshake done).
    const result = await new Promise<{ ready: boolean; error: Error | null }>((resolve) => {
      const timeout = setTimeout(() => resolve({ ready: false, error: new Error("WhatsApp connection timed out") }), 100000);
      const onUpdate = (u: any) => {
        if (u.qr || u.connection === "open") {
          clearTimeout(timeout);
          sock.ev.off("connection.update", onUpdate);
          resolve({ ready: true, error: null });
        } else if (u.lastDisconnect?.error) {
          clearTimeout(timeout);
          sock.ev.off("connection.update", onUpdate);
          resolve({ ready: false, error: u.lastDisconnect.error });
        }
      };
      sock.ev.on("connection.update", onUpdate);
    });

    if (result.error) throw result.error;

    try {
      const code = await sock.requestPairingCode(cleanNumber);
      const PAIRING_CODE_TTL_MS = 120_000;
      const expiresAt = Date.now() + PAIRING_CODE_TTL_MS;
      pairing.code = code;
      pairing.codeExpiresAt = expiresAt;
      waTrace(userId, "code_emitted", { code, expiresAt });
      return { code, expiresAt };
    } catch (e: any) {
      console.error("Failed to request WhatsApp pairing code:", e);
      pairingSessions.delete(userId);
      throw new Error(e.message || "Failed to generate pairing code.");
    }
  }

  /**
   * Current pairing code + expiry, or linked status. Returns null if no pairing active.
   */
  public static getPairingCode(userId: string): { code: string; expiresAt: number; connected: boolean } | null {
    const pairing = pairingSessions.get(userId);
    if (!pairing) return null;
    if (pairing.connected) return { code: "", expiresAt: 0, connected: true };
    if (!pairing.code || !pairing.codeExpiresAt) return null;
    return { code: pairing.code, expiresAt: pairing.codeExpiresAt, connected: false };
  }

  /**
   * Helper to check if a user has a verified WhatsApp session (connected socket).
   */
  public static hasVerifiedSession(userId: string): boolean {
    const pairing = pairingSessions.get(userId);
    return !!pairing?.connected;
  }

  /**
   * Destroy current pairing and start fresh (code expired / user requested new code).
   */
  public static async refreshPairingCode(userId: string, phone: string): Promise<{ code: string; expiresAt: number }> {
    return WhatsAppClientManager.requestPairingCode(userId, phone);
  }

  /**
   * Shared QR socket builder + handler wiring. Used by BOTH the destructive
   * entry (startPairingQR) and the non-destructive renewal (renewPairingQR) so
   * both paths behave identically.
   *
   * QR expiry (Baileys qrTimeout) re-emits a fresh `qr` on the SAME socket —
   * it never closes. So a "close" event on this socket is either:
   *  - a genuine logout (401) → teardown the session (only legit destroyer),
   *  - a transient failure (network drop / server restart / refs exhausted)
   *    BEFORE the phone authorized → keep the pairing state + DB session alive;
   *    the frontend renews non-destructively to get a fresh QR.
   *  - a post-pair restart → reconnect to the verified getClient path.
   */
  private static async buildQRSocket(
    userId: string,
    auth: { saveCreds: (c?: any) => Promise<void>; flush: () => Promise<void> },
    pairing: PairingState,
    authState: any,
  ) {
    const { version: waVersion } = await fetchLatestWaWebVersion().catch(() => ({
      version: undefined,
    }));
    const sock = makeWASocket({
      ...waSocketConfig(waVersion, { qrTimeout: WA_QR_TTL_MS }),
      auth: authState,
      logger: pino({ level: "debug", name: "baileys-qr" }) as any,
    });
    pairing.sock = sock;
    pairing.latestQR = null;
    pairing.qrExpiresAt = null;
    pairing.sockAlive = true;

    waTrace(userId, "qr_socket_created");

    sock.ev.on("creds.update", async (credsPayload: any) => {
      try {
        await auth.saveCreds(credsPayload);
        // pair-success lands `creds.me.id` BEFORE `isNewLogin` is emitted. Flip
        // paired immediately so a countdown-zero renewal can never race an
        // in-flight authorization (renewPairingQR skips paired sessions).
        if (credsPayload?.me?.id && !pairing.paired) {
          pairing.paired = true;
          waTrace(userId, "qr_creds_me_id");
        }
        waTrace(userId, "qr_creds_saved");
      } catch (e) {
        console.error(`[wa-auth] qr creds.save FAILED userId=${userId}`, e);
      }
    });

    sock.ev.on("connection.update", async (update: any) => {
      try {
        const code = (update.lastDisconnect?.error as any)?.output?.statusCode;
        waTrace(userId, "qr_connection_update", {
          connection: update.connection,
          isNewLogin: update.isNewLogin,
          hasQR: !!update.qr,
          disconnectCode: code,
        });

        if (update.qr) {
          // QR expiry never closes the socket — Baileys re-emits a fresh QR on
          // this same socket. Just record it (and its absolute expiry) so the
          // frontend countdown is always backend-driven.
          pairing.latestQR = update.qr;
          pairing.qrExpiresAt = Date.now() + WA_QR_TTL_MS;
          waTrace(userId, "qr_received", { ttlMs: WA_QR_TTL_MS });
        }

        if (update.isNewLogin) {
          if (!pairing.paired) {
            pairing.paired = true;
            waTrace(userId, "qr_phone_authorized");
            try {
              await auth.flush();
              waTrace(userId, "qr_creds_flushed");
            } catch (e) {
              console.error(`[wa-auth] qr flush FAILED userId=${userId}`, e);
            }
          }
        }

        if (update.connection === "close") {
          waTrace(userId, "qr_closed", { statusCode: code, paired: pairing.paired, connected: pairing.connected });
          activeSockets.delete(userId);
          socketOpen.delete(userId);
          pairing.sockAlive = false;
          if (pairing.paired) {
            waTrace(userId, "qr_validating_session");
            setTimeout(() => {
              WhatsAppClientManager.getClient(userId)
                .then(() => waTrace(userId, "qr_reconnected"))
                .catch((e) => console.error(`[wa-auth] qr reconnect FAILED userId=${userId}`, e));
            }, 1000);
            return;
          }
          // Pre-auth close. Only a genuine 401 (phone revoked) destroys; any
          // transient close keeps the pairing + DB session so the user can
          // renew without re-linking.
          const action = decidePairingClose(code, pairing.paired);
          if (action === "teardown_session") {
            waTrace(userId, "qr_teardown_logged_out", { statusCode: code });
            pairingSessions.delete(userId);
            try { await sessionsRepo.deleteSession(userId); } catch {}
            try { await disconnectConnection(userId, "whatsapp"); } catch (e) {
              console.error("Failed to delete connection on QR logout:", e);
            }
          } else {
            // keep — transient close preserves the pairing for renewal.
            waTrace(userId, "qr_kept_on_transient_close", { statusCode: code, action });
          }
        }
      } catch (e) {
        console.error(`WhatsApp QR pairing connection.update handler error for ${userId}:`, e);
      }
    });

    return sock;
  }

  /** Resolves with the first QR emitted on a freshly-built QR socket. */
  private static waitForFirstQR(userId: string, sock: any, pairing: PairingState): Promise<{ qr: string | null; error: Error | null }> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve({ qr: null, error: new Error("QR code timed out") }), 100000);
      const onUpdate = (u: any) => {
        if (u.qr) {
          clearTimeout(timeout);
          sock.ev.off("connection.update", onUpdate);
          pairing.latestQR = u.qr;
          pairing.qrExpiresAt = Date.now() + WA_QR_TTL_MS;
          resolve({ qr: u.qr, error: null });
        } else if (u.connection === "open") {
          clearTimeout(timeout);
          sock.ev.off("connection.update", onUpdate);
          resolve({ qr: null, error: null });
        } else if (u.lastDisconnect?.error) {
          clearTimeout(timeout);
          sock.ev.off("connection.update", onUpdate);
          resolve({ qr: null, error: u.lastDisconnect.error });
        }
      };
      sock.ev.on("connection.update", onUpdate);
    });
  }

  /**
   * Starts a QR-based Baileys pairing session and returns the first QR payload.
   * DESTRUCTIVE: wipes any previous pairing/socket/session. Only call this for
   * a genuine fresh link, not for renewal.
   */
  public static async startPairingQR(userId: string): Promise<{ qr: string; expiresAt: number }> {
    const cleanPairing = () => {
      const existing = pairingSessions.get(userId);
      if (existing) {
        try { existing.sock.end(undefined); } catch {}
        pairingSessions.delete(userId);
      }
      if (activeSockets.has(userId)) {
        try { activeSockets.get(userId).end(undefined); } catch {}
        activeSockets.delete(userId);
        socketOpen.delete(userId);
      }
    };
    cleanPairing();

    await sessionsRepo.deleteSession(userId);
    const { state, saveCreds, flush } = await useDBAuthState(userId);

    const pairing: PairingState = { sock: null as any, latestQR: null, qrExpiresAt: null, code: null, codeExpiresAt: null, connected: false, paired: false, sockAlive: true, phone: "", method: "qr" };
    pairingSessions.set(userId, pairing);

    const sock = await WhatsAppClientManager.buildQRSocket(userId, { saveCreds, flush }, pairing, state);
    waTrace(userId, "qr_socket_created_start");

    const result = await WhatsAppClientManager.waitForFirstQR(userId, sock, pairing);
    if (result.error) throw result.error;
    if (!result.qr) {
      // Connection opened without QR (already authenticated via creds)
      return { qr: "", expiresAt: Date.now() + WA_QR_TTL_MS };
    }
    return { qr: result.qr, expiresAt: pairing.qrExpiresAt || Date.now() + WA_QR_TTL_MS };
  }

  /**
   * Non-destructive QR renewal. When the countdown hits zero (or the socket was
   * transiently closed pre-auth), regenerate a fresh QR WITHOUT tearing down:
   *  - the same pairing session,
   *  - the DB session / creds,
   *  - listeners (the old socket is ended, a fresh one is wired identically).
   * The frontend never needs to refresh the page.
   */
  public static async renewPairingQR(userId: string): Promise<{ qr: string; expiresAt: number }> {
    const existing = pairingSessions.get(userId);
    const hasPairing = !!existing;
    const action = decidePairingRenewal(
      hasPairing,
      existing?.method === "qr",
      existing?.paired ?? false,
      existing?.connected ?? false,
      existing?.sockAlive ?? false,
    );

    // No active pairing at all — a genuine first link.
    if (action === "start_fresh") {
      return WhatsAppClientManager.startPairingQR(userId);
    }

    // already verified / still on a live socket → keep current QR + expiry.
    // A live socket re-emits fresh QRs itself; a scan may be mid-authorization.
    if (action === "keep_current") {
      return {
        qr: existing?.latestQR || "",
        expiresAt: existing?.qrExpiresAt || Date.now() + WA_QR_TTL_MS,
      };
    }

    // Socket is dead (transient close) but pairing + DB session are preserved.
    // Rebuild only the socket, keeping the same pairing session + auth state.
    const { state, saveCreds, flush } = await useDBAuthState(userId);
    try { existing!.sock.end(undefined); } catch {}
    pairingSessions.set(userId, existing!);

    const sock = await WhatsAppClientManager.buildQRSocket(userId, { saveCreds, flush }, existing!, state);
    const result = await WhatsAppClientManager.waitForFirstQR(userId, sock, existing!);
    if (result.error) throw result.error;
    if (!result.qr) {
      return { qr: "", expiresAt: Date.now() + WA_QR_TTL_MS };
    }
    return { qr: result.qr, expiresAt: existing!.qrExpiresAt || Date.now() + WA_QR_TTL_MS };
  }

  /**
   * Current QR string + connection status. Returns null if no QR session active.
   */
  public static getPairingQR(userId: string): { qr?: string; expiresAt?: number; connected: boolean } | null {
    const pairing = pairingSessions.get(userId);
    if (!pairing || pairing.method !== "qr") return null;
    if (pairing.connected) return { connected: true };
    if (pairing.latestQR) {
      return { qr: pairing.latestQR, expiresAt: pairing.qrExpiresAt || undefined, connected: false };
    }
    return { connected: false };
  }

  /**
   * Refresh QR pairing — NON-DESTRUCTIVE renewal. Keeps the pairing session,
   * auth state and DB session; only the socket + QR are regenerated.
   */
  public static async refreshPairingQR(userId: string): Promise<{ qr: string; expiresAt: number }> {
    return WhatsAppClientManager.renewPairingQR(userId);
  }

  /**
   * Destroy an unused pairing session (modal closed / user cancelled).
   */
  public static async cancelPairing(userId: string): Promise<void> {
    const pairing = pairingSessions.get(userId);
    if (pairing) {
      try { pairing.sock.end(undefined); } catch {}
      pairingSessions.delete(userId);
      await sessionsRepo.deleteSession(userId);
    }
  }

  /**
   * Helper to verify if session files exist for the user
   */
  public static async isSessionSaved(userId: string): Promise<boolean> {
    try {
      return await sessionsRepo.sessionExists(userId);
    } catch {
      return false;
    }
  }

  /**
   * Disconnects and removes authentication credentials
   */
  public static async disconnect(userId: string): Promise<void> {
    if (activeSockets.has(userId)) {
      try {
        const sock = activeSockets.get(userId);
        sock.logout();
        sock.end(undefined);
      } catch {}
      activeSockets.delete(userId);
      socketOpen.delete(userId);
    }
    const pairing = pairingSessions.get(userId);
    if (pairing) {
      try { pairing.sock.end(undefined); } catch {}
      pairingSessions.delete(userId);
    }

    await sessionsRepo.deleteSession(userId);

    // Flush any queued durable messages before tearing down.
    try { await flushPersist(userId); } catch {}

    // Clear in-memory cache/state so no stale data reads after logout.
    const store = messageStore.get(userId);
    if (store) store.clear();
    messageStore.delete(userId);
    historyActivity.delete(userId);
    syncCounters.delete(userId);
    chatIds.delete(userId);
    contactIds.delete(userId);
    initialSyncDone.delete(userId);
    const flushTimer = flushTimers.get(userId);
    if (flushTimer) clearTimeout(flushTimer);
    flushTimers.delete(userId);
    const persistTimer = persistTimers.get(userId);
    if (persistTimer) clearTimeout(persistTimer);
    persistTimers.delete(userId);
    persistQueues.delete(userId);
    persistIntegrationIds.delete(userId);

    const cacheDir = path.join(MESSAGE_CACHE_DIR, userId);
    if (fs.existsSync(cacheDir)) {
      try {
        fs.rmSync(cacheDir, { recursive: true, force: true });
      } catch (e) {
        console.error("Failed to remove message cache:", e);
      }
    }
  }

  /**
   * Fetch messages from local cache. Returns empty array if no real messages received yet.
   */
  public static getMessages(userId: string, chatId?: string): any[] {
    const store = ensureStore(userId);
    const cached = [...store.values()];
    return chatId ? cached.filter(m => m.from === chatId) : cached;
  }

  /**
   * Fetch messages preferring the durable unified store (survives restarts),
   * falling back to the in-process cache when no DB copies exist yet. This is
   * what the briefing pipeline should call: a cold server instance that has not
   * re-restored the Baileys socket still answers with real synchronized data.
   */
  public static async getMessagesDurable(userId: string, chatId?: string, limit = 50): Promise<any[]> {
    try {
      const { getRecentMessages } = await import("@/lib/repositories/unified-store-repository");
      let integrationId = persistIntegrationIds.get(userId);
      if (!integrationId) {
        const record = await new IntegrationsRepository(createAdminDb()).findByUserAndProvider(userId, "whatsapp");
        integrationId = record?.id || "";
        if (integrationId) persistIntegrationIds.set(userId, integrationId);
      }
      if (integrationId) {
        const rows = await getRecentMessages(userId, integrationId, limit * 2);
        const mapped = rows.map((r: { provider_message_id?: string | null; channel_id?: string | null; body_text?: string | null; sent_at?: string | null; metadata?: unknown }) => {
          const meta = (r.metadata || {}) as { fromName?: string; isGroup?: boolean; groupName?: string | null };
          return {
            id: r.provider_message_id,
            from: r.channel_id,
            fromName: meta.fromName || "WhatsApp User",
            message: r.body_text,
            timestamp: r.sent_at,
            isGroup: !!meta.isGroup,
            senderName: meta.groupName || undefined,
          };
        });
        const scoped = chatId ? mapped.filter((m) => m.from === chatId) : mapped;
        if (scoped.length > 0) return scoped.slice(0, limit);
      }
    } catch (err) {
      console.warn(`[wa-unified] durable read failed for ${userId}:`, err);
    }
    return this.getMessages(userId, chatId).slice(0, limit);
  }

  /**
   * Unified readiness for the WhatsApp integration. Single source of truth for
   * every consumer (provider tools, briefing, dashboard, AI summaries, search).
   * The message cache is treated as a performance layer ONLY: no code may read
   * it unless this returns `ready`.
   *
   * Readiness is DB-backed (session creds + last successful sync), NOT tied to
   * a live in-memory socket: a server restart wipes activeSockets/socketOpen/
   * initialSyncDone but the persisted state proves the flushed disk cache is
   * complete, so the cache stays readable and WhatsApp never silently vanishes
   * from the briefing. The socket is restored lazily in the background so live
   * delivery resumes without the user having to re-pair.
   */
  public static async getConnectionState(userId: string): Promise<WhatsAppConnectionState> {
    const sock = activeSockets.get(userId);
    const [hasSession, integration] = await Promise.all([
      sessionsRepo.sessionExists(userId),
      new IntegrationsRepository(createAdminDb()).findByUserAndProvider(userId, "whatsapp"),
    ]);

    const authOk = hasSession && !!integration && integration.status === "active";
    let isSocketOpen = !!sock && socketOpen.has(userId);
    let lastSyncOk = integration?.sync_status === "success";

    // Lazy restore: DB says connected but no socket in this process (restart).
    // Re-open it in the background, deduped against concurrent probes from the
    // briefing, dashboard, maintenance and tools. Callers AWAIT the restore
    // (bounded) so a briefing/tool call during a mid-restart window still gets
    // the live socket instead of returning empty and silently dropping the
    // provider from the run.
    if (authOk && !isSocketOpen) {
      if (!restoring.has(userId)) {
        restoring.add(userId);
        WhatsAppClientManager.getClient(userId)
          .catch(err => console.error(`[wa-auth] lazy restore failed userId=${userId}`, err))
          .finally(() => restoring.delete(userId));
      }
      // Bounded wait for the restore to open (covers the cold-start window
      // before the open handler re-runs initial sync and flips sync_status).
      for (let i = 0; i < 40; i++) {
        if (socketOpen.has(userId)) { isSocketOpen = true; break; }
        if (!restoring.has(userId) && !activeSockets.has(userId)) break;
        await new Promise(r => setTimeout(r, 250));
      }
    }

    const sessionValid = isSocketOpen && !!sock?.user?.id;
    const initialSyncCompleted = initialSyncDone.has(userId);

    // The open handler may have just re-run initial sync and flipped
    // sync_status to success during the restore wait — recompute so the brief
    // that follows a cold restart sees ready=true instead of a stale empty.
    if (!lastSyncOk && isSocketOpen) {
      const refetched = await new IntegrationsRepository(createAdminDb())
        .findByUserAndProvider(userId, "whatsapp");
      lastSyncOk = refetched?.sync_status === "success";
    }

    return {
      authOk,
      socketOpen: isSocketOpen,
      sessionValid,
      initialSyncDone: initialSyncCompleted,
      lastSyncOk,
      ready: authOk && lastSyncOk,
    };
  }
}
