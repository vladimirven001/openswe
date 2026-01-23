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

/**
 * Set the current log level
 */
export function setLogLevel(level: LogLevel) {
  currentLevel = level
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

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog("debug")) {
      console.debug(formatMessage("debug", args))
    }
  },

  info: (...args: unknown[]) => {
    if (shouldLog("info")) {
      console.log(formatMessage("info", args))
    }
  },

  warn: (...args: unknown[]) => {
    if (shouldLog("warn")) {
      console.warn(formatMessage("warn", args))
    }
  },

  error: (...args: unknown[]) => {
    if (shouldLog("error")) {
      console.error(formatMessage("error", args))
    }
  },
}

export default logger
