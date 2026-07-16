/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/rules-of-hooks */

// Tell ws to skip the native bufferutil addon (can be broken in some environments)
process.env.WS_NO_BUFFER_UTIL = "1";

import makeWASocket, {
  DisconnectReason,
  BufferJSON,
  initAuthCreds,
} from "@whiskeysockets/baileys";
import pino from "pino";
import path from "path";
import fs from "fs";
import { saveConnection, disconnectConnection } from "@/app/actions/integrations";
import { WhatsAppSessionsRepository } from "@/lib/repositories/whatsapp-sessions-repository";

// In-memory cache of active Baileys socket connections
const activeSockets = new Map<string, any>();

const sessionsRepo = new WhatsAppSessionsRepository();

// DB-backed auth state (replacement for useMultiFileAuthState)
async function useDBAuthState(userId: string): Promise<{
  state: { creds: any; keys: { get: (type: string, ids: string[]) => Promise<Record<string, any>>; set: (data: Record<string, Record<string, any>>) => Promise<void> } };
  saveCreds: () => Promise<void>;
}> {
  let creds: any;
  let keysCache: Record<string, any> = {};
  let saveQueued = false;

  const persist = async () => {
    saveQueued = false;
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
      // Baileys passes the updated creds to the handler — merge them into
      // our closure so persist() serialises the freshest state.
      if (newCreds) Object.assign(creds, newCreds);
      await persist();
    },
  };
}

// JSON file-based message cache (kept for simplicity, not auth-critical)
const MESSAGE_CACHE_DIR = path.join(process.cwd(), ".insforge", "whatsapp-cache");

function ensureCacheDir(userId: string): string {
  const dir = path.join(MESSAGE_CACHE_DIR, userId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getMessageCachePath(userId: string): string {
  return path.join(ensureCacheDir(userId), "messages_cache.json");
}

function loadCachedMessages(userId: string): any[] {
  const cachePath = getMessageCachePath(userId);
  if (fs.existsSync(cachePath)) {
    try {
      return JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    } catch {
      return [];
    }
  }
  return [];
}

function cacheMessage(userId: string, message: any) {
  const cachePath = getMessageCachePath(userId);
  const messages = loadCachedMessages(userId);
  messages.unshift(message);
  if (messages.length > 100) {
    messages.pop();
  }
  try {
    fs.writeFileSync(cachePath, JSON.stringify(messages, null, 2));
  } catch (e) {
    console.error("Failed to write WhatsApp message cache:", e);
  }
}

export class WhatsAppClientManager {
  /**
   * Initializes or returns a Baileys connection for a user
   */
  public static async getClient(userId: string, forceReconnect = false): Promise<any> {
    if (activeSockets.has(userId) && !forceReconnect) {
      return activeSockets.get(userId);
    }

    const { state, saveCreds } = await useDBAuthState(userId);

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }) as any,
      printQRInTerminal: false,
      browser: ["Windows", "Chrome", "20.0.04"],
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      try {
        const { connection, lastDisconnect } = update;

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const hasSession = await WhatsAppClientManager.isSessionSaved(userId);
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && hasSession;

          console.log(`WhatsApp connection closed for ${userId}. Reconnecting: ${shouldReconnect}. Error:`, lastDisconnect?.error);

          activeSockets.delete(userId);
          if (shouldReconnect) {
            // Clear stale DB connection record so getWhatsAppStatusAction
            // does not return a stale "pairing" status while reconnecting.
            try { await disconnectConnection(userId, "whatsapp"); } catch {}
            setTimeout(() => {
              this.getClient(userId).catch(err => console.error("Error reconnecting WhatsApp:", err));
            }, 3000);
          } else {
            try {
              await disconnectConnection(userId, "whatsapp");
            } catch (e) {
              console.error("Failed to delete connection on logout:", e);
            }
          }
        } else if (connection === "open") {
          console.log(`WhatsApp connection opened successfully for user: ${userId}`);
          const userJid = sock.user?.id ? sock.user.id.split(":")[0] : "unknown";
          const formattedJid = `${userJid}@s.whatsapp.net`;
        
        // Save to DB
        try {
          await saveConnection(
            userId,
            "whatsapp",
            formattedJid,
            `whatsapp_token_${userId}`,
            undefined,
            365 * 24 * 3600
          );
        } catch (dbErr) {
          console.error("Failed to save WhatsApp connection to DB:", dbErr);
        }
      }
    } catch (handlerErr) {
      console.error(`WhatsApp connection.update handler error for ${userId}:`, handlerErr);
    }
  });

    // Cache incoming messages
    sock.ev.on("messages.upsert", async (m) => {
      if (m.type === "notify") {
        for (const msg of m.messages) {
          if (!msg.message) continue;
          
          const text = msg.message.conversation || 
                       msg.message.extendedTextMessage?.text || 
                       "";
          if (!text) continue;

          const from = msg.key.remoteJid || "";
          const fromMe = msg.key.fromMe || false;
          const name = msg.pushName || "WhatsApp User";

          cacheMessage(userId, {
            id: msg.key.id,
            from,
            fromName: fromMe ? "Me" : name,
            message: text,
            timestamp: new Date(Number(msg.messageTimestamp) * 1000).toISOString(),
            isGroup: from.endsWith("@g.us"),
            senderName: from.endsWith("@g.us") ? name : undefined,
          });
        }
      }
    });

    activeSockets.set(userId, sock);
    return sock;
  }

  /**
   * Request pairing code for WhatsApp Web link
   */
  public static async requestPairingCode(userId: string, phoneNumber: string): Promise<string> {
    const cleanNumber = phoneNumber.replace(/\D/g, "");
    if (!cleanNumber) throw new Error("Invalid phone number format.");

    // Force close any existing connection
    if (activeSockets.has(userId)) {
      try { activeSockets.get(userId).end(undefined); } catch {}
      activeSockets.delete(userId);
    }

    // Wipe any stale session — a previous failed attempt may have persisted
    // creds.me via saveCreds, which would make Baileys try to LOG IN instead
    // of REGISTER on the next attempt.
    await sessionsRepo.deleteSession(userId);

    // Create a fresh auth state (initAuthCreds ensures no stale creds.me)
    const { state, saveCreds } = await useDBAuthState(userId);

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: "debug", name: "baileys-pairing" }) as any,
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 30000,
      keepAliveIntervalMs: 45000,
      retryRequestDelayMs: 500,
      waWebSocketUrl: "wss://web.whatsapp.com/ws/chat",
      version: [2, 3000, 1035194821],
    });

    // After pair-success the server sends stream:error (515) → connection close.
    // Wait for that close before removing from activeSockets, so the async
    // persist() in saveCreds has time to finish writing the full paired creds.
    const detachOnClose = (update: any) => {
      if (update.connection === "close") {
        console.log("Pairing socket closed after pair-success, removing from activeSockets.");
        activeSockets.delete(userId);
        sock.ev.off("connection.update", detachOnClose);
        sock.ev.off("connection.update", waitForReady);
        clearTimeout(waitTimeout);
      }
    };
    const pairHandler = (update: any) => {
      if (update.isNewLogin) {
        console.log("WhatsApp paired successfully, will detach on next close.");
        sock.ev.off("connection.update", pairHandler);
        sock.ev.on("connection.update", detachOnClose);
      }
    };
    sock.ev.on("connection.update", pairHandler);

    sock.ev.on("creds.update", saveCreds);

    // Log underlying WebSocket errors
    setTimeout(() => {
      const ws = (sock as any).ws;
      if (ws) {
        ws.on("error", (err: any) => console.error("WhatsApp WebSocket error:", err?.message || err));
        ws.on("close", (code: number, reason: string) => console.warn("WhatsApp WebSocket closed with code", code, reason?.toString() || ""));
      }
    }, 500);

    // Wait for the socket to be ready:
    //   - Baileys v7 emits { qr } after the noise handshake completes (transport ready)
    //   - At this point ws.isOpen is true AND transport keys are set
    //   - creds.me is still clean (not set by requestPairingCode yet)
    //   - The server already sent the pair-device IQ, but it also accepts
    //     link_code_companion_reg (pairing-code) IQ concurrently.
    //   - We have ~60s before the first QR expires.
    let waitTimeout: ReturnType<typeof setTimeout>;
    let waitForReady: (update: any) => void;
    const result = await new Promise<{ qr: boolean; error: Error | null }>((resolve) => {
      waitTimeout = setTimeout(() => resolve({ qr: false, error: new Error("WhatsApp connection timed out") }), 45000);
      waitForReady = (update: any) => {
        console.log(`WhatsApp pairing connection.update:`, JSON.stringify({
          connection: update.connection, hasError: !!update.lastDisconnect?.error,
          hasQR: !!update.qr, hasReceivedPending: !!update.receivedPendingNotifications,
          keys: Object.keys(update),
        }));
        if (update.qr || update.connection === "open") {
          clearTimeout(waitTimeout);
          sock.ev.off("connection.update", waitForReady);
          resolve({ qr: !!update.qr, error: null });
        } else if (update.lastDisconnect?.error) {
          clearTimeout(waitTimeout);
          sock.ev.off("connection.update", waitForReady);
          resolve({ qr: false, error: update.lastDisconnect.error });
        }
      };
      sock.ev.on("connection.update", waitForReady);
    });

    if (result.error) throw result.error;

    // Now the WebSocket is open, noise handshake is complete, and creds.me
    // is still unset. Call requestPairingCode ONCE — it sets creds.me + sends
    // the link_code_companion_reg IQ encrypted with transport keys.
    try {
      const code = await sock.requestPairingCode(cleanNumber);
      console.log("WhatsApp pairing code obtained:", code);
      return code;
    } catch (e: any) {
      console.error("Failed to request WhatsApp pairing code:", e);
      activeSockets.delete(userId);
      throw new Error(e.message || "Failed to generate pairing code.");
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
    }

    await sessionsRepo.deleteSession(userId);

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
    const cached = loadCachedMessages(userId);
    return chatId ? cached.filter(m => m.from === chatId) : cached;
  }
}
