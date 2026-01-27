/**
 * Main configuration module for OpenSWE
 *
 * This module orchestrates loading configuration from multiple sources
 * with the following precedence (highest to lowest):
 * 1. CLI flags
 * 2. Environment variables (OPENSWE_*)
 * 3. Global config file (~/.config/openswe/config.toml)
 * 4. Built-in defaults
 */

// Re-export all types
export * from "./types"
export type {
  GlobalConfig,
  PartialConfig,
  CLIOverrides,
  AIBackend,
  LogLevel,
  AIConfig,
  PRConfig,
  KeybindingsConfig,
  AdvancedConfig,
} from "./types"

// Re-export defaults
export { DEFAULT_CONFIG } from "./defaults"

// Re-export global config utilities
export {
  getConfigDir,
  getConfigPath,
  configFileExists,
  saveGlobalConfig,
} from "./global"

import type { GlobalConfig, PartialConfig, CLIOverrides, DeepPartial } from "./types"
import { DEFAULT_CONFIG } from "./defaults"
import { loadEnvConfig } from "./env"
import { loadGlobalConfig } from "./global"

// ============================================================================
// Deep Merge Utility
// ============================================================================

/**
 * Deep merge two objects, with source values overriding target values
 * Arrays are replaced, not merged
 */
export function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = structuredClone(target)

  for (const key of Object.keys(source)) {
    const sourceValue = (source as Record<string, unknown>)[key]
    const targetValue = (result as Record<string, unknown>)[key]

    if (sourceValue === undefined) {
      continue
    }

    if (
      sourceValue !== null &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue)
    ) {
      // Recursively merge nested objects
      ;(result as Record<string, unknown>)[key] = deepMerge(
        targetValue as object,
        sourceValue as DeepPartial<object>
      )
    } else {
      // Replace value (including arrays)
      ;(result as Record<string, unknown>)[key] = sourceValue
    }
  }

  return result
}

// ============================================================================
// CLI Overrides
// ============================================================================

/**
 * Apply CLI flag overrides to config
 */
function applyCLIOverrides(config: GlobalConfig, cli: CLIOverrides): GlobalConfig {
  const result = structuredClone(config)

  if (cli.backend !== undefined) {
    result.ai.backend = cli.backend
  }

  if (cli.model !== undefined) {
    const activeBackend = result.ai.backend
    if (activeBackend === "opencode") {
      result.ai.opencode.model = cli.model
    } else if (activeBackend === "claude") {
      result.ai.claude.model = cli.model
    }
  }

  if (cli.debug === true) {
    result.advanced.logLevel = "debug"
  }

  return result
}

// ============================================================================
// Main Load Function
// ============================================================================

/**
 * Load and merge configuration from all sources
 *
 * Precedence (highest to lowest):
 * 1. CLI overrides
 * 2. Environment variables
 * 3. Global config file
 * 4. Built-in defaults
 *
 * @param cliOverrides - Optional CLI flag overrides
 * @returns Fully resolved configuration
 */
export async function loadConfig(cliOverrides?: CLIOverrides): Promise<GlobalConfig> {
  // 1. Start with defaults
  let config: GlobalConfig = structuredClone(DEFAULT_CONFIG)

  // 2. Merge global config file (if exists)
  const fileConfig = await loadGlobalConfig()
  config = deepMerge(config, fileConfig)

  // 3. Merge environment variables
  const envConfig = loadEnvConfig()
  config = deepMerge(config, envConfig)

  // 4. Apply CLI overrides (highest priority)
  if (cliOverrides) {
    config = applyCLIOverrides(config, cliOverrides)
  }

  return config
}

/**
 * Load configuration synchronously (for use in non-async contexts)
 * Note: This skips loading the config file since file I/O is async
 *
 * @param cliOverrides - Optional CLI flag overrides
 * @returns Configuration with defaults + env + CLI (no file)
 */
export function loadConfigSync(cliOverrides?: CLIOverrides): GlobalConfig {
  // 1. Start with defaults
  let config: GlobalConfig = structuredClone(DEFAULT_CONFIG)

  // 2. Skip file config (would require async)

  // 3. Merge environment variables
  const envConfig = loadEnvConfig()
  config = deepMerge(config, envConfig)

  // 4. Apply CLI overrides
  if (cliOverrides) {
    config = applyCLIOverrides(config, cliOverrides)
  }

  return config
}
