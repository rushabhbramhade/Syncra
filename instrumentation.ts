/**
 * Next.js instrumentation hook — runs once per server process start,
 * on both the Edge and Node runtimes. Use it to bootstrap singletons
 * that must survive across requests (event handlers, queues, etc.).
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only initialize server-side singletons in the Node.js runtime.
  // The notification event handler requires DB access and is not
  // compatible with the Edge runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { notificationEventHandler } = await import(
      "@/lib/notifications/event-handler"
    );

    await notificationEventHandler.initialize().catch((err: unknown) => {
      console.error(
        "[instrumentation] Failed to initialize notification event handler:",
        err,
      );
    });
  }
}
