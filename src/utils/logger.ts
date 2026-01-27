/**
 * Logging utility for OpenSWE
 */

import type { LogLevel } from "../config/types"

// Re-export LogLevel for convenience
export type { LogLevel }

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// Can be overridden by config/env
let currentLevel: LogLevel = "info"
let logFileSink: any = null

/**
 * Set the current log level
 */
export function setLogLevel(level: LogLevel) {
  currentLevel = level
}

/**
 * Initialize file logging
 * @param path - Absolute path to the log file
 */
export function initFileLogging(path: string) {
  try {
    const file = Bun.file(path)
    logFileSink = file.writer()
  } catch (error) {
    console.error("Failed to initialize file logging:", error)
  }
}

/**
 * Get the current log level
 */
export function getLogLevel(): LogLevel {
  return currentLevel
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function formatTimestamp(): string {
  return new Date().toISOString()
}

function formatValue(value: unknown): string {
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (typeof value === "string") return value
  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatMessage(level: LogLevel, args: unknown[]): string {
  const timestamp = formatTimestamp()
  const levelStr = level.toUpperCase().padEnd(5)
  const message = args.map(formatValue).join(" ")
  return `[${timestamp}] [${levelStr}] ${message}`
}

function log(level: LogLevel, args: unknown[]) {
  if (shouldLog(level)) {
    const msg = formatMessage(level, args)

    // Console output
    switch (level) {
      case "debug":
        console.debug(msg)
        break
      case "info":
        console.log(msg)
        break
      case "warn":
        console.warn(msg)
        break
      case "error":
        console.error(msg)
        break
    }

    // File output
    if (logFileSink) {
      logFileSink.write(msg + "\n")
      logFileSink.flush()
    }
  }
}

export const logger = {
  debug: (...args: unknown[]) => log("debug", args),
  info: (...args: unknown[]) => log("info", args),
  warn: (...args: unknown[]) => log("warn", args),
  error: (...args: unknown[]) => log("error", args),
}

export default logger
