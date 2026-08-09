/**
 * Seed scenario builder for the Gmail staging validation harness.
 *
 * Pure module — builds the exact controlled dataset the runbook instructs an
 * operator to create in the staging inbox. This is what the acceptance checks
 * verify against. No live calls here.
 */

export type SeedMessageKind =
  | "normal"
  | "high_priority"
  | "unread"
  | "needs_reply"
  | "empty_content"
  | "thread_root"
  | "thread_reply";

export interface SeedMessageSpec {
  messageId: string;
  kind: SeedMessageKind;
  subject: string;
  labels: string[];
  unread: boolean;
  from: string;
  body: string;
  sentAtMs: number;
}

export interface ThreadSpec {
  threadId: string;
  root: SeedMessageSpec;
  replies: SeedMessageSpec[];
}

export interface SeedScenario {
  nonce: string;
  subjectPrefix: string;
  messages: SeedMessageSpec[];
  threads: ThreadSpec[];
}

const STAGING_SENDER = "Staging Validator <staging-validator@example.org>";

export const SEED_PREFIX = "[SYNCRA-STAGING]";

const SUBJECTS: Record<SeedMessageKind, string> = {
  normal: "Normal update | weekly digest ready",
  high_priority: "High priority — board review requested",
  unread: "Unread — import approvals",
  needs_reply: "Needs reply — can you confirm budget?",
  empty_content: "Empty content — no body here",
  thread_root: "Thread root — project status",
  thread_reply: "Thread reply",
};

function makeMessage(
  messageId: string,
  kind: SeedMessageKind,
  subject: string,
  sentAtMs: number,
  extra?: Partial<SeedMessageSpec>
): SeedMessageSpec {
  return {
    messageId,
    kind,
    subject,
    labels: ["INBOX"],
    unread: kind === "unread",
    from: STAGING_SENDER,
    body: "",
    sentAtMs,
    ...extra,
  };
}

/** Build the scenario razor: one message per acceptance-relevant property. */
export function buildSeedScenario(nonce: string, now = Date.now()): SeedScenario {
  const t = (agoMs: number) => now - agoMs;

  const messages: SeedMessageSpec[] = [
    makeMessage(
      `${nonce}-normal`,
      "normal",
      `${SEED_PREFIX} ${nonce} | ${SUBJECTS.normal}`,
      t(6_000_000),
      { body: "Digest item text that should rank normal in the briefing." }
    ),
    makeMessage(
      `${nonce}-high`,
      "high_priority",
      `${SEED_PREFIX} ${nonce} | ${SUBJECTS.high_priority}`,
      t(7_200_000),
      { body: "High priority actionable item for urgent review." }
    ),
    makeMessage(
      `${nonce}-unread`,
      "unread",
      `${SEED_PREFIX} ${nonce} | ${SUBJECTS.unread}`,
      t(8_400_000),
      { body: "Approvals queue; the unread flag must be preserved.", unread: true }
    ),
    makeMessage(
      `${nonce}-reply`,
      "needs_reply",
      `${SEED_PREFIX} ${nonce} | ${SUBJECTS.needs_reply}`,
      t(10_000_000),
      { body: "Can you confirm the final number before EOD?" }
    ),
    makeMessage(
      `${nonce}-empty`,
      "empty_content",
      `${SEED_PREFIX} ${nonce} | ${SUBJECTS.empty_content}`,
      t(11_000_000)
    ),
  ];

  const threadRoot = makeMessage(
    `${nonce}-thread-root`,
    "thread_root",
    `${SEED_PREFIX} ${nonce} | ${SUBJECTS.thread_root}`,
    t(3_600_000),
    { body: "Root message: shipping status for the quarter.", unread: true }
  );
  const threadReply = makeMessage(
    `${nonce}-thread-reply`,
    "thread_reply",
    `Re: ${SEED_PREFIX} ${nonce} | ${SUBJECTS.thread_root}`,
    t(1_800_000),
    { body: "Follow-up: list of attached risks." }
  );

  return {
    nonce,
    subjectPrefix: `${SEED_PREFIX} ${nonce}`,
    messages,
    threads: [{ threadId: `${nonce}-thread`, root: threadRoot, replies: [threadReply] }],
  };
}