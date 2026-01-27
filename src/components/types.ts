/**
 * Component type definitions for OpenSWE TUI
 */

import type { Session, Phase, Status, ProjectState } from "../store"
import type { GlobalConfig, AIBackend } from "../config"
import type { ProviderBranding } from "../providers"

// ============================================================================
// Constants
// ============================================================================

/** Status icons for session display */
export const STATUS_ICONS: Record<Status, string> = {
  active: "●",
  queued: "○",
  needs_attention: "!",
  completed: "✓",
  paused: "P",
  failed: "✗",
}

/** Ordered list of phases for progress calculation */
export const PHASE_ORDER: readonly Phase[] = [
  "pending",
  "planning",
  "working",
  "completed",
  "failed",
]

/** Human-readable phase display names */
export const PHASE_DISPLAY_NAMES: Record<Phase, string> = {
  pending: "Pending",
  planning: "Planning",
  working: "Building",
  completed: "Done",
  failed: "Failed",
}

// ============================================================================
// Modal Types
// ============================================================================

/** Active modal state */
export type ModalType = "none" | "tasks" | "issues" | "help" | "confirm-delete" | "manual" | "provider"

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
  listWidth: number
}

/** Props for individual session cards */
export interface SessionCardProps {
  session: Session
  isSelected: boolean
  availableWidth: number
}

/** Props for the preview pane */
export interface PreviewProps {
  session: Session | null
  startedAt?: Date
  snapshotLines?: string[]
  providerBranding?: ProviderBranding
}

/** Props for the status bar */
export interface StatusBarProps {
  variant: "header" | "footer"
  // Header variant props
  repoName?: string
  taskCount?: number
  backend?: string
  sessionId?: string
  providerBranding?: ProviderBranding
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
  /** Current AI backend */
  currentBackend: AIBackend
  /** Callback when modal is closed */
  onClose: () => void
  /** Callback when sessions are created - receives created sessions for auto-start */
  onSessionsCreated: (sessions: Session[]) => void
}

/** Props for ManualSessionModal component */
export interface ManualSessionModalProps {
  /** Absolute path to the project root */
  projectRoot: string
  /** Current AI backend */
  currentBackend: AIBackend
  /** Callback when modal is closed */
  onClose: () => void
  /** Callback when sessions are created (for refreshing the list) */
  onSessionCreated: () => void
}

/** Props for TaskQueueModal component */
export interface TaskQueueModalProps {
  /** Callback when modal is closed */
  onClose: () => void
  /** Callback when user selects a task to jump to its session */
  onJumpToSession: (sessionId: string) => void
}

/** Props for ProviderSwitcherModal component */
export interface ProviderSwitcherModalProps {
  /** Current AI backend */
  currentBackend: AIBackend
  /** Callback when a provider is selected */
  onSelect: (backend: AIBackend) => void
  /** Callback when modal is closed */
  onClose: () => void
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
