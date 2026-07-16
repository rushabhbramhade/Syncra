import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

let correlationId: string | undefined;

export function getCorrelationId(): string | undefined {
  return correlationId;
}

export function setCorrelationId(id: string): void {
  correlationId = id;
}

export function clearCorrelationId(): void {
  correlationId = undefined;
}

function generateId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createLogger(component?: string) {
  return pino({
    level: isDev ? "debug" : "info",
    transport: isDev ? { target: "pino-pretty", options: { colorize: true } } : undefined,
    mixin() {
      return { correlationId: correlationId || generateId(), component };
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
  });
}

type LogFn = (msg: string, ...args: any[]) => void;

export interface Logger {
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  debug: LogFn;
  child: (bindings: Record<string, unknown>) => Logger;
}

const defaultLogger = createLogger();

export const logger: Logger = {
  info: (msg, ...args) => defaultLogger.info(msg, ...args),
  warn: (msg, ...args) => defaultLogger.warn(msg, ...args),
  error: (msg, ...args) => defaultLogger.error(msg, ...args),
  debug: (msg, ...args) => defaultLogger.debug(msg, ...args),
  child: (bindings) => {
    const childLogger = defaultLogger.child(bindings);
    return {
      info: (msg, ...args) => childLogger.info(msg, ...args),
      warn: (msg, ...args) => childLogger.warn(msg, ...args),
      error: (msg, ...args) => childLogger.error(msg, ...args),
      debug: (msg, ...args) => childLogger.debug(msg, ...args),
      child: (b) => ({
        info: (msg, ...args) => childLogger.child(b).info(msg, ...args),
        warn: (msg, ...args) => childLogger.child(b).warn(msg, ...args),
        error: (msg, ...args) => childLogger.child(b).error(msg, ...args),
        debug: (msg, ...args) => childLogger.child(b).debug(msg, ...args),
      }),
    };
  },
};
