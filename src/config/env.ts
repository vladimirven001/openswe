/**
 * Environment variable configuration loader
 *
 * Parses OPENSWE_* environment variables into a partial config.
 * Uses lenient validation - warns and skips invalid values.
 */

import type { PartialConfig } from "./types"
import { isValidBackend, isValidLogLevel } from "./types"

/**
 * Parse a string to boolean
 * Accepts: "true", "1", "yes" as true; "false", "0", "no" as false
 */
function parseBoolean(val: string): boolean | undefined {
  const lower = val.toLowerCase().trim()
  if (["true", "1", "yes"].includes(lower)) return true
  if (["false", "0", "no"].includes(lower)) return false
  return undefined
}

/**
 * Log a warning for invalid environment variable values
 * Uses console.warn directly to avoid circular dependency with logger
 */
function warnInvalidEnv(varName: string, value: string, expected: string): void {
  console.warn(
    `[OpenSWE] Invalid value for ${varName}="${value}". Expected ${expected}. Using default.`
  )
}

/**
 * Load configuration from environment variables
 *
 * Supported variables:
 * - OPENSWE_BACKEND: "opencode" | "claude"
 * - OPENSWE_LOG_LEVEL: "debug" | "info" | "warn" | "error"
 */
export function loadEnvConfig(): PartialConfig {
  const config: PartialConfig = {}

  // AI Backend
  const backend = process.env.OPENSWE_BACKEND
  if (backend !== undefined) {
    if (isValidBackend(backend)) {
      config.ai = { backend }
    } else {
      warnInvalidEnv("OPENSWE_BACKEND", backend, '"opencode", "claude", or "codex"')
    }
  }

  // Log Level
  const logLevel = process.env.OPENSWE_LOG_LEVEL
  if (logLevel !== undefined) {
    if (isValidLogLevel(logLevel)) {
      config.advanced = { logLevel }
    } else {
      warnInvalidEnv(
        "OPENSWE_LOG_LEVEL",
        logLevel,
        '"debug", "info", "warn", or "error"'
      )
    }
  }

  return config
}
