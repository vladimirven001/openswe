/**
 * Default configuration values for openswe
 */

import type { GlobalConfig } from "./types"

/**
 * Default global configuration
 * Used as the base when no config file exists or for missing values
 */
export const DEFAULT_CONFIG: GlobalConfig = {
  ai: {
    backend: "opencode",
    opencode: {
      provider: "anthropic",
    },
    claude: {
      // Provider uses its own default model
    },
    codex: {
      // Provider uses its own default model
    },
  },

  keybindings: {
    navigateUp: "k",
    navigateDown: "j",
    select: "Enter",
    newSession: "n",
    deleteSession: "d",
    pauseSession: "p",
    taskQueue: "t",
    issues: "i",
    quit: "q",
    help: "?",
  },

  advanced: {
    logLevel: "info",
  },

  ui: {
    theme: "tokyonight",
    themeMode: "dark",
  },
}
