/**
 * Configuration type definitions for OpenSWE
 */

// ============================================================================
// Type Literals
// ============================================================================

/** Supported AI backends */
export type AIBackend = "opencode" | "claude" | "codex"

/** Log levels in order of verbosity */
export type LogLevel = "debug" | "info" | "warn" | "error"

// ============================================================================
// Sub-Configuration Interfaces
// ============================================================================

/** OpenCode-specific AI configuration */
export interface OpenCodeConfig {
  provider: string
}

/** Claude-specific AI configuration */
export interface ClaudeConfig {
  // Provider uses its own default model
}

/** OpenAI Codex-specific AI configuration */
export interface CodexConfig {
  // Provider uses its own default model
}

/** AI backend configuration */
export interface AIConfig {
  backend: AIBackend
  opencode: OpenCodeConfig
  claude: ClaudeConfig
  codex: CodexConfig
}

/** Keyboard shortcut configuration */
export interface KeybindingsConfig {
  navigateUp: string
  navigateDown: string
  select: string
  newSession: string
  deleteSession: string
  pauseSession: string
  taskQueue: string
  issues: string
  quit: string
  help: string
}

/** Advanced/debug configuration */
export interface AdvancedConfig {
  logLevel: LogLevel
}

/** UI/Theme configuration */
export interface UIConfig {
  /** Theme name (bundled or custom) */
  theme: string
  /** Theme mode (dark or light) */
  themeMode: "dark" | "light"
}

// ============================================================================
// Full Configuration Interface
// ============================================================================

/** Complete global configuration */
export interface GlobalConfig {
  ai: AIConfig
  keybindings: KeybindingsConfig
  advanced: AdvancedConfig
  ui: UIConfig
}

// ============================================================================
// Utility Types
// ============================================================================

/** Deep partial type - makes all nested properties optional */
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T

/** Partial configuration for merging sources */
export type PartialConfig = DeepPartial<GlobalConfig>

/** CLI flags that can override configuration */
export interface CLIOverrides {
  backend?: AIBackend
  debug?: boolean
}

// ============================================================================
// Type Guards
// ============================================================================

/** Valid AI backend values */
const VALID_BACKENDS: readonly AIBackend[] = ["opencode", "claude", "codex"]

/** Valid log level values */
const VALID_LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"]

/**
 * Check if a value is a valid AI backend
 */
export function isValidBackend(val: unknown): val is AIBackend {
  return typeof val === "string" && VALID_BACKENDS.includes(val as AIBackend)
}

/**
 * Check if a value is a valid log level
 */
export function isValidLogLevel(val: unknown): val is LogLevel {
  return typeof val === "string" && VALID_LOG_LEVELS.includes(val as LogLevel)
}

/**
 * Check if a value is a boolean
 */
export function isBoolean(val: unknown): val is boolean {
  return typeof val === "boolean"
}

/**
 * Check if a value is a non-empty string
 */
export function isNonEmptyString(val: unknown): val is string {
  return typeof val === "string" && val.length > 0
}
