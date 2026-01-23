/**
 * Theme configuration for OpenSWE TUI
 *
 * Defines colors, border styles, and layout constants
 * Colors are derived from the theme system for consistency
 */

import type { Status } from "../store"
import type { ResolvedTheme } from "../theme/types"
import { getDefaultTheme } from "../theme/context"

// ============================================================================
// Color Palette - Derived from Theme System
// ============================================================================

/**
 * Create colors object from a resolved theme
 * This allows components to use either the reactive theme or static defaults
 */
export function createColors(theme: ResolvedTheme) {
  return {
    // Background colors
    bg: {
      primary: theme.background,
      secondary: theme.backgroundPanel,
      card: theme.backgroundElement,
      cardSelected: theme.borderSubtle,
    },

    // Text colors
    text: {
      primary: theme.text,
      secondary: theme.textMuted,
      muted: theme.borderSubtle,
      inverse: theme.background,
    },

    // Status colors (semantic colors)
    status: {
      active: theme.success,
      queued: theme.borderSubtle,
      needs_attention: theme.warning,
      completed: theme.success,
      paused: theme.info,
      failed: theme.error,
    } as Record<Status, string>,

    // Border colors
    border: {
      primary: theme.border,
      secondary: theme.borderSubtle,
      accent: theme.accent,
    },

    // Progress bar colors
    progress: {
      filled: theme.primary,
      empty: theme.backgroundElement,
      text: theme.accent,
    },

    // Accent colors
    accent: {
      primary: theme.primary,
      secondary: theme.secondary,
      success: theme.success,
      warning: theme.warning,
      error: theme.error,
      info: theme.info,
    },
  }
}

/** Default colors using the default theme (tokyonight) */
export const colors = createColors(getDefaultTheme())

// ============================================================================
// Border Styles
// ============================================================================

export const borders = {
  // Rounded borders for main panels
  panel: {
    topLeft: "╭",
    topRight: "╮",
    bottomLeft: "╰",
    bottomRight: "╯",
    horizontal: "─",
    vertical: "│",
  },

  // Single line borders for cards
  card: {
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    horizontal: "─",
    vertical: "│",
  },

  // Double borders for emphasis
  double: {
    topLeft: "╔",
    topRight: "╗",
    bottomLeft: "╚",
    bottomRight: "╝",
    horizontal: "═",
    vertical: "║",
  },
}

// ============================================================================
// Layout Constants
// ============================================================================

export const layout = {
  // Pane widths (percentages)
  sessionListWidth: "30%",
  previewWidth: "70%",

  // Padding values
  padding: {
    none: 0,
    small: 1,
    medium: 2,
    large: 3,
  },

  // Card dimensions
  card: {
    minHeight: 4,
    padding: 1,
  },

  // Status bar heights
  statusBar: {
    height: 1,
  },

  // Minimum dimensions
  minWidth: 80,
  minHeight: 24,
}

// ============================================================================
// Typography
// ============================================================================

export const typography = {
  // Truncation lengths
  maxSessionNameLength: 25,
  maxIssueNumberWidth: 8,
  maxTokensWidth: 8,
}

// ============================================================================
// Modal Dimensions
// ============================================================================

export const modals = {
  issueSelector: {
    width: 70,
    height: 24,
  },
  taskQueue: {
    width: 70,
    height: 22,
  },
  help: {
    width: 44,
    height: 24,
  },
  confirm: {
    width: 45,
  },
  manualSession: {
    width: 50,
  },
}

// ============================================================================
// Keybinding Display
// ============================================================================

export const keybindings = {
  navigate: "j/k or ↑/↓",
  newSession: "n",
  issues: "i",
  select: "Enter",
  tasks: "t",
  help: "?",
  quit: "q",
}
