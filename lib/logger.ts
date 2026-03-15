/**
 * Structured logger for server-side use.
 * Outputs JSON in production (parseable by Vercel log drains) and
 * human-readable text in development — zero external dependencies.
 *
 * Usage:
 *   import { logger } from "@/lib/logger"
 *   const log = logger("approve-user")
 *
 *   // All three call forms are accepted:
 *   log.info("Simple message")
 *   log.info({ userId }, "User approved")          // pino-style structured
 *   log.error("Approval failed", err)              // legacy (msg, extra) style
 */

type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
  level: LogLevel
  ns: string
  msg: string
  time: string
  [key: string]: unknown
}

const IS_PROD = process.env.NODE_ENV === "production"

function write(level: LogLevel, ns: string, data: Record<string, unknown>, msg: string) {
  const entry: LogEntry = { level, ns, msg, time: new Date().toISOString(), ...data }

  if (IS_PROD) {
    // Structured JSON — readable by Vercel log drains and external log aggregators
    const line = JSON.stringify(entry)
    if (level === "error") {
      console.error(line)
    } else if (level === "warn") {
      console.warn(line)
    } else {
      console.log(line)
    }
  } else {
    // Human-readable in dev: [LEVEL] ns: msg {extra}
    const extras = Object.keys(data).length ? ` ${JSON.stringify(data)}` : ""
    const text = `[${level.toUpperCase()}] ${ns}: ${msg}${extras}`
    if (level === "error") console.error(text)
    else if (level === "warn") console.warn(text)
    else console.log(text)
  }
}

export interface Logger {
  /** Structured form: log.debug({ key: val }, "message") */
  debug(data: Record<string, unknown>, msg: string): void
  /** Simple form: log.debug("message") */
  debug(msg: string): void
  /** Legacy two-arg form: log.debug("message", extraData) */
  debug(msg: string, extra: unknown): void

  info(data: Record<string, unknown>, msg: string): void
  info(msg: string): void
  info(msg: string, extra: unknown): void

  warn(data: Record<string, unknown>, msg: string): void
  warn(msg: string): void
  warn(msg: string, extra: unknown): void

  error(data: Record<string, unknown>, msg: string): void
  error(msg: string): void
  error(msg: string, extra: unknown): void
}

function makeLevel(level: LogLevel, ns: string) {
  return (dataOrMsg: Record<string, unknown> | string, msgOrExtra?: string | unknown) => {
    if (typeof dataOrMsg === "string") {
      // log.x("msg") or log.x("msg", extra)
      const extra = msgOrExtra !== undefined ? { extra: msgOrExtra } : {}
      write(level, ns, extra as Record<string, unknown>, dataOrMsg)
    } else {
      // log.x({ data }, "msg")
      write(level, ns, dataOrMsg, typeof msgOrExtra === "string" ? msgOrExtra : "")
    }
  }
}

/**
 * Create a namespaced logger.
 * @param ns  Namespace, e.g. "approve-user" or "leave-workflow"
 */
export function logger(ns: string): Logger {
  return {
    debug: makeLevel("debug", ns),
    info: makeLevel("info", ns),
    warn: makeLevel("warn", ns),
    error: makeLevel("error", ns),
  }
}
