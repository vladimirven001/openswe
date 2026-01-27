/**
 * Default configuration values for OpenSWE
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
      model: "claude-sonnet",
      provider: "anthropic",
    },
    claude: {
      model: "claude-sonnet-4-20250514",
    },
  },

  pr: {
    autoCreate: true,
    draft: true,
    titleTemplate: "{{issue_title}}",
    bodyTemplate: `Fixes #{{issue_number}}

## Summary
{{ai_summary}}

---
*Automated by OpenSWE*`,
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
