/**
 * Structured logger for server-side use.
 * Outputs JSON in production (parseable by Vercel log drains) and
 * human-readable text in development — zero external dependencies.
 *
 * Usage:
 *   import { logger } from "@/lib/logger"

const log = logger("lib-logger")
 *   const log = logger("approve-user")
 *   log.info({ userId }, "User approved")
 *   log.error({ err }, "Approval failed")
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
      log.error(line)
    } else if (level === "warn") {
      log.warn(line)
    } else {
      log.debug(line)
    }
  } else {
    // Human-readable in dev: [LEVEL] ns: msg {extra}
    const extras = Object.keys(data).length ? ` ${JSON.stringify(data)}` : ""
    const text = `[${level.toUpperCase()}] ${ns}: ${msg}${extras}`
    if (level === "error") log.error(text)
    else if (level === "warn") log.warn(text)
    else log.debug(text)
  }
}

export interface Logger {
  debug(data: Record<string, unknown>, msg: string): void
  debug(msg: string): void
  info(data: Record<string, unknown>, msg: string): void
  info(msg: string): void
  warn(data: Record<string, unknown>, msg: string): void
  warn(msg: string): void
  error(data: Record<string, unknown>, msg: string): void
  error(msg: string): void
}

function makeLevel(level: LogLevel, ns: string) {
  return (dataOrMsg: Record<string, unknown> | string, msg?: string) => {
    if (typeof dataOrMsg === "string") {
      write(level, ns, {}, dataOrMsg)
    } else {
      write(level, ns, dataOrMsg, msg ?? "")
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
