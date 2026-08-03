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

function wrapLogger(base: ReturnType<typeof createLogger>): Logger {
  return {
    info: (msg, ...args) => base.info(msg, ...args),
    warn: (msg, ...args) => base.warn(msg, ...args),
    error: (msg, ...args) => base.error(msg, ...args),
    debug: (msg, ...args) => base.debug(msg, ...args),
    child: (bindings) => wrapLogger(base.child(bindings)),
  };
}

export const logger: Logger = wrapLogger(defaultLogger);
