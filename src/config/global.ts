/**
 * Global configuration file loader and saver
 *
 * Handles loading and saving TOML config files with XDG support.
 * Location: $XDG_CONFIG_HOME/openswe/config.toml or ~/.config/openswe/config.toml
 */

import { parse as parseToml, stringify as stringifyToml, type JsonMap } from "@iarna/toml"
import { homedir } from "os"
import { join } from "path"
import { mkdir } from "fs/promises"
import type { PartialConfig } from "./types"
import { isValidBackend, isValidLogLevel, isBoolean, isNonEmptyString } from "./types"

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Get the configuration directory path (XDG-compliant)
 */
export function getConfigDir(): string {
  const xdgConfig = process.env.XDG_CONFIG_HOME
  if (xdgConfig) {
    return join(xdgConfig, "openswe")
  }
  return join(homedir(), ".config", "openswe")
}

/**
 * Get the full path to the config file
 */
export function getConfigPath(): string {
  return join(getConfigDir(), "config.toml")
}

/**
 * Check if the config file exists
 */
export async function configFileExists(): Promise<boolean> {
  const file = Bun.file(getConfigPath())
  return file.exists()
}

// ============================================================================
// Key Transformation (snake_case <-> camelCase)
// ============================================================================

/** Map of camelCase keys to snake_case TOML keys */
const CAMEL_TO_SNAKE: Record<string, string> = {
  navigateUp: "navigate_up",
  navigateDown: "navigate_down",
  newSession: "new_session",
  deleteSession: "delete_session",
  pauseSession: "pause_session",
  taskQueue: "task_queue",
  logLevel: "log_level",
}

/** Map of snake_case TOML keys to camelCase keys */
const SNAKE_TO_CAMEL: Record<string, string> = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
)

/**
 * Convert a snake_case key to camelCase
 */
function snakeToCamel(key: string): string {
  return SNAKE_TO_CAMEL[key] ?? key
}

/**
 * Convert a camelCase key to snake_case
 */
function camelToSnake(key: string): string {
  return CAMEL_TO_SNAKE[key] ?? key
}

/**
 * Recursively transform object keys from snake_case to camelCase
 */
function transformKeysSnakeToCamel(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(transformKeysSnakeToCamel)
  if (typeof obj !== "object") return obj

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const camelKey = snakeToCamel(key)
    result[camelKey] = transformKeysSnakeToCamel(value)
  }
  return result
}

/**
 * Recursively transform object keys from camelCase to snake_case
 */
function transformKeysCamelToSnake(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(transformKeysCamelToSnake)
  if (typeof obj !== "object") return obj

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const snakeKey = camelToSnake(key)
    result[snakeKey] = transformKeysCamelToSnake(value)
  }
  return result
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate and sanitize parsed TOML config
 * Returns a partial config with only valid values
 */
function validateParsedConfig(parsed: unknown): PartialConfig {
  if (typeof parsed !== "object" || parsed === null) {
    return {}
  }

  const raw = parsed as Record<string, unknown>
  const config: PartialConfig = {}

  // Validate ai section
  if (raw.ai && typeof raw.ai === "object") {
    const ai = raw.ai as Record<string, unknown>
    config.ai = {}

    if (isValidBackend(ai.backend)) {
      config.ai.backend = ai.backend
    } else if (ai.backend !== undefined) {
      warnInvalidConfig("ai.backend", ai.backend, '"opencode" or "claude"')
    }

    if (ai.opencode && typeof ai.opencode === "object") {
      const oc = ai.opencode as Record<string, unknown>
      config.ai.opencode = {}
      if (isNonEmptyString(oc.model)) config.ai.opencode.model = oc.model
      if (isNonEmptyString(oc.provider)) config.ai.opencode.provider = oc.provider
    }

    if (ai.claude && typeof ai.claude === "object") {
      const cl = ai.claude as Record<string, unknown>
      config.ai.claude = {}
      if (isNonEmptyString(cl.model)) config.ai.claude.model = cl.model
    }
  }

  // Validate keybindings section
  if (raw.keybindings && typeof raw.keybindings === "object") {
    const kb = raw.keybindings as Record<string, unknown>
    config.keybindings = {}

    const keyFields = [
      "navigateUp", "navigateDown", "select", "newSession",
      "deleteSession", "pauseSession", "taskQueue", "issues", "quit", "help"
    ] as const

    for (const field of keyFields) {
      if (isNonEmptyString(kb[field])) {
        (config.keybindings as Record<string, string>)[field] = kb[field] as string
      }
    }
  }

  // Validate advanced section
  if (raw.advanced && typeof raw.advanced === "object") {
    const adv = raw.advanced as Record<string, unknown>
    config.advanced = {}

    if (isValidLogLevel(adv.logLevel)) {
      config.advanced.logLevel = adv.logLevel
    } else if (adv.logLevel !== undefined) {
      warnInvalidConfig("advanced.logLevel", adv.logLevel, '"debug", "info", "warn", or "error"')
    }
  }

  return config
}

/**
 * Log a warning for invalid config file values
 */
function warnInvalidConfig(path: string, value: unknown, expected: string): void {
  console.warn(
    `[OpenSWE] Invalid config value at "${path}": ${JSON.stringify(value)}. Expected ${expected}. Using default.`
  )
}

// ============================================================================
// Load and Save Functions
// ============================================================================

/**
 * Load global configuration from TOML file
 * Returns empty partial config if file doesn't exist or has errors
 */
export async function loadGlobalConfig(): Promise<PartialConfig> {
  const configPath = getConfigPath()

  try {
    const file = Bun.file(configPath)
    if (!(await file.exists())) {
      return {} // No config file yet - use defaults
    }

    const content = await file.text()
    const parsed = parseToml(content)

    // Transform snake_case keys to camelCase
    const transformed = transformKeysSnakeToCamel(parsed)

    // Validate and return
    return validateParsedConfig(transformed)
  } catch (err) {
    if (err instanceof Error) {
      console.warn(`[OpenSWE] Failed to load config from ${configPath}: ${err.message}`)
    } else {
      console.warn(`[OpenSWE] Failed to load config from ${configPath}`)
    }
    return {}
  }
}

/**
 * Save configuration to TOML file
 * Creates the config directory if it doesn't exist
 */
export async function saveGlobalConfig(config: PartialConfig): Promise<void> {
  const configDir = getConfigDir()
  const configPath = getConfigPath()

  try {
    // Ensure config directory exists
    await mkdir(configDir, { recursive: true })

    // Transform camelCase keys to snake_case for TOML
    const transformed = transformKeysCamelToSnake(config) as Record<string, unknown>

    // Stringify and write
    const tomlContent = stringifyToml(transformed as JsonMap)
    await Bun.write(configPath, tomlContent)
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`Failed to save config to ${configPath}: ${err.message}`)
    }
    throw new Error(`Failed to save config to ${configPath}`)
  }
}
