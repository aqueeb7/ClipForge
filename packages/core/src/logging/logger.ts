import pino from "pino";

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

export interface LoggerOptions {
  level?: LogLevel;
  pretty?: boolean;
}

export function createLogger(options: LoggerOptions = {}) {
  const level = options.level ?? (process.env["CLIPFORGE_LOG_LEVEL"] as LogLevel) ?? "info";
  const pretty = options.pretty ?? (process.env["NODE_ENV"] !== "production");

  if (pretty) {
    return pino({
      level,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname"
        }
      }
    });
  }

  return pino({
    level,
    timestamp: pino.stdTimeFunctions.isoTime
  });
}

export const logger = createLogger();
export type Logger = ReturnType<typeof createLogger>;
