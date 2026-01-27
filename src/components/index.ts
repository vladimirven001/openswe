/**
 * Components module - OpenSWE TUI components
 *
 * Exports all components and types for the TUI interface.
 */

// ============================================================================
// Components
// ============================================================================

export { App } from "./App"
export { StatusBar } from "./StatusBar"
export { SessionList } from "./SessionList"
export { SessionCard } from "./SessionCard"
export { Preview } from "./Preview"
export { PhaseProgress } from "./PhaseProgress"
export { HelpModal } from "./HelpModal"
export { ConfirmDialog } from "./ConfirmDialog"
export { TaskQueueModal } from "./TaskQueueModal"
export { ManualSessionModal } from "./ManualSessionModal"
export { SessionTerminal } from "./SessionTerminal"

// ============================================================================
// Types
// ============================================================================

export type {
  AppProps,
  StatusBarProps,
  SessionListProps,
  SessionCardProps,
  PreviewProps,
  PhaseProgressProps,
  HelpModalProps,
  ConfirmDialogProps,
  TaskQueueModalProps,
  ManualSessionModalProps,
  PendingAction,
  ModalType,
  ProjectInfo,
} from "./types"

export {
  STATUS_ICONS,
  PHASE_ORDER,
  PHASE_DISPLAY_NAMES,
  getPhaseProgress,
  generateProgressBar,
} from "./types"

// ============================================================================
// Theme
// ============================================================================

export { colors, borders, layout, typography, keybindings } from "./theme"
