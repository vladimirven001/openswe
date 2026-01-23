/**
 * Component type definitions for OpenSWE TUI
 */

import type { Session, Phase, Status, ProjectState } from "../store"
import type { GlobalConfig } from "../config"

// ============================================================================
// Constants
// ============================================================================

/** Status icons for session display */
export const STATUS_ICONS: Record<Status, string> = {
  active: "●",
  queued: "○",
  needs_attention: "⚠",
  completed: "✓",
  paused: "⏸",
  failed: "✗",
}

/** Ordered list of phases for progress calculation */
export const PHASE_ORDER: readonly Phase[] = [
  "pending",
  "research",
  "planning",
  "coding",
  "testing",
  "pr_creation",
  "completed",
  "failed",
]

/** Human-readable phase display names */
export const PHASE_DISPLAY_NAMES: Record<Phase, string> = {
  pending: "Pending",
  research: "Research",
  planning: "Planning",
  coding: "Coding",
  testing: "Testing",
  pr_creation: "PR Creation",
  completed: "Completed",
  failed: "Failed",
}

// ============================================================================
// Modal Types
// ============================================================================

/** Active modal state */
export type ModalType = "none" | "tasks" | "issues" | "help" | "confirm-delete"

// ============================================================================
// Component Props
// ============================================================================

/** Props for the root App component */
export interface AppProps {
  config: GlobalConfig
  projectRoot: string
}

/** Props for the session list component */
export interface SessionListProps {
  sessions: Session[]
  selectedIndex: number
  onSelect: (index: number) => void
}

/** Props for individual session cards */
export interface SessionCardProps {
  session: Session
  isSelected: boolean
}

/** Props for the preview pane */
export interface PreviewProps {
  session: Session | null
  lines: string[]
}

/** Props for the status bar */
export interface StatusBarProps {
  variant: "header" | "footer"
  // Header variant props
  repoName?: string
  taskCount?: number
  backend?: string
  // Footer variant props (keybinding hints)
}

/** Props for phase progress indicator */
export interface PhaseProgressProps {
  phase: Phase
  variant: "inline" | "full"
}

/** Props for HelpModal component */
export interface HelpModalProps {
  onClose: () => void
}

/** Props for ConfirmDialog component */
export interface ConfirmDialogProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

/** Props for IssueSelectorModal component */
export interface IssueSelectorModalProps {
  /** Repository in "owner/repo" format */
  ownerRepo: string
  /** Absolute path to the project root */
  projectRoot: string
  /** Callback when modal is closed */
  onClose: () => void
  /** Callback when sessions are created (for refreshing the list) */
  onSessionsCreated: () => void
}

/** Props for TaskQueueModal component */
export interface TaskQueueModalProps {
  /** Callback when modal is closed */
  onClose: () => void
  /** Callback when user selects a task to jump to its session */
  onJumpToSession: (sessionId: string) => void
}

/** Pending action for confirmation dialogs */
export interface PendingAction {
  type: "delete"
  sessionId: string
  sessionName: string
}

// ============================================================================
// Derived Types
// ============================================================================

/** Project info for header display */
export interface ProjectInfo {
  repoFullName: string
  repoUrl: string
  maxActiveSessions: number | null
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the progress percentage for a given phase
 * Returns 0-100 based on phase position in workflow
 */
export function getPhaseProgress(phase: Phase): number {
  const index = PHASE_ORDER.indexOf(phase)
  if (index === -1) return 0
  // failed and completed are at the end, treat them as 100%
  if (phase === "completed" || phase === "failed") return 100
  // Calculate progress (excluding completed/failed which are terminal states)
  const progressPhases = PHASE_ORDER.slice(0, -2)
  const progressIndex = progressPhases.indexOf(phase)
  if (progressIndex === -1) return 100
  return Math.round((progressIndex / (progressPhases.length - 1)) * 100)
}

/**
 * Generate a progress bar string
 * @param progress - Progress percentage (0-100)
 * @param width - Total width of the progress bar
 */
export function generateProgressBar(progress: number, width: number = 10): string {
  const filled = Math.round((progress / 100) * width)
  const empty = width - filled
  return "█".repeat(filled) + "░".repeat(empty)
}
