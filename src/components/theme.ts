/**
 * Theme configuration for OpenSWE TUI
 *
 * Defines colors, border styles, and layout constants
 */

import type { Status } from "../store"

// ============================================================================
// Color Palette
// ============================================================================

export const colors = {
  // Background colors
  bg: {
    primary: "#1a1a2e",
    secondary: "#16213e",
    card: "#1f2937",
    cardSelected: "#374151",
  },

  // Text colors
  text: {
    primary: "#e5e7eb",
    secondary: "#9ca3af",
    muted: "#6b7280",
    inverse: "#1a1a2e",
  },

  // Status colors
  status: {
    active: "#22c55e", // green
    queued: "#6b7280", // gray
    needs_attention: "#eab308", // yellow
    completed: "#22c55e", // green
    paused: "#3b82f6", // blue
    failed: "#ef4444", // red
  } as Record<Status, string>,

  // Border colors
  border: {
    primary: "#374151",
    secondary: "#4b5563",
    accent: "#3b82f6",
  },

  // Progress bar colors
  progress: {
    filled: "#3b82f6",
    empty: "#374151",
    text: "#60a5fa",
  },

  // Accent colors
  accent: {
    primary: "#3b82f6", // blue
    success: "#22c55e", // green
    warning: "#eab308", // yellow
    error: "#ef4444", // red
  },
}

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
// Keybinding Display
// ============================================================================

export const keybindings = {
  navigate: "j/k or ↑/↓",
  select: "Enter",
  tasks: "t",
  issues: "i",
  help: "?",
  quit: "q",
}
