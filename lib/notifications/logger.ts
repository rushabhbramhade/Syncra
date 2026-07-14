import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const notificationLogger = pino({
  level: isDev ? "debug" : "info",
  transport: isDev ? { target: "pino-pretty", options: { colorize: true } } : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export const queueLogger = notificationLogger.child({ component: "queue" });
export const providerLogger = notificationLogger.child({ component: "provider" });
export const serviceLogger = notificationLogger.child({ component: "service" });
export const templateLogger = notificationLogger.child({ component: "template" });
export const eventLogger = notificationLogger.child({ component: "event" });