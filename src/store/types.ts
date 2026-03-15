/**
 * Database type definitions for openswe
 *
 * Defines types for sessions, human tasks, project state, and output buffers
 * stored in the SQLite database.
 */

// ============================================================================
// Enums / Type Literals
// ============================================================================

/** Session phases representing the workflow stages */
export type Phase =
  | "pending"
  | "planning"
  | "working"
  | "completed"
  | "failed"

/** Session status for tracking current state */
export type Status =
  | "queued"
  | "active"
  | "paused"
  | "needs_attention"
  | "completed"
  | "failed"

/** Backend session reference for AI integrations */
export interface AISessionData {
  backend: "opencode" | "claude" | "codex"
  sessionId?: string
  sessionTitle?: string
  [key: string]: unknown
}

// ============================================================================
// Session Types
// ============================================================================

/** A session represents work on a specific issue or task */
export interface Session {
  /** Unique identifier (UUID) */
  id: string
  /** Human-readable session name */
  name: string
  /** GitHub issue number (if linked to an issue) */
  issueNumber: number | null
  /** GitHub issue title (cached) */
  issueTitle: string | null
  /** GitHub issue body/description (cached) */
  issueBody: string | null
  /** GitHub issue URL (for quick access) */
  issueUrl: string | null
  /** Absolute path to the git worktree for this session */
  worktreePath: string
  /** Git branch name for this session */
  branchName: string
  /** Current workflow phase */
  phase: Phase
  /** Current session status */
  status: Status
  /** Reason for needs_attention status */
  attentionReason: string | null
  /** Number of retry attempts */
  retryCount: number
  /** Total tokens used by AI */
  tokensUsed: number
  /** Process ID if session is running */
  pid: number | null
  /** AI backend session reference data */
  aiSessionData: AISessionData | null
  /** ISO timestamp when session was last opened/running */
  openedAt: string | null
  /** ISO timestamp when session was created */
  createdAt: string
  /** ISO timestamp when session was last updated */
  updatedAt: string
}

/** Input for creating a new session */
export interface CreateSessionInput {
  name: string
  issueNumber?: number
  issueTitle?: string
  issueBody?: string
  issueUrl?: string
  worktreePath: string
  branchName: string
  aiSessionData?: AISessionData | null
}

/** Input for updating an existing session */
export interface UpdateSessionInput {
  name?: string
  phase?: Phase
  status?: Status
  attentionReason?: string | null
  retryCount?: number
  tokensUsed?: number
  pid?: number | null
  aiSessionData?: AISessionData | null
  openedAt?: string | null
}

// ============================================================================
// Human Task Types - REMOVED
// ============================================================================

// ============================================================================
// Project State Types
// ============================================================================

/**
 * Project state stored in the database
 *
 * Note: This is distinct from ProjectConfig in workspace/project.ts.
 * ProjectConfig is stored in .openswe/project.json and is the source of truth.
 * ProjectState in the database mirrors essential fields for querying.
 */
export interface ProjectState {
  /** Always 1 (singleton) */
  id: 1
  /** Full repository name in owner/repo format */
  repoFullName: string
  /** Git remote URL */
  repoUrl: string
  /** ISO timestamp when project was created */
  createdAt: string
  /** ISO timestamp when project was last opened */
  lastOpenedAt: string
}

/** Input for creating project state */
export interface CreateProjectInput {
  repoFullName: string
  repoUrl: string
}

// ============================================================================
// Output Buffer Types
// ============================================================================

/** Circular buffer for session output */
export interface OutputBuffer {
  /** Session ID this buffer belongs to */
  sessionId: string
  /** Array of output lines (stored as JSON) */
  lines: string[]
  /** ISO timestamp when buffer was last updated */
  lastUpdated: string
}

// ============================================================================
// Type Guards
// ============================================================================

const VALID_PHASES: readonly Phase[] = [
  "pending",
  "planning",
  "working",
  "completed",
  "failed",
]

const VALID_STATUSES: readonly Status[] = [
  "queued",
  "active",
  "paused",
  "needs_attention",
  "completed",
  "failed",
]

const VALID_AI_BACKENDS = ["opencode", "claude", "codex"] as const

/** Check if a value is a valid Phase */
export function isValidPhase(val: unknown): val is Phase {
  return typeof val === "string" && VALID_PHASES.includes(val as Phase)
}

/** Check if a value is a valid Status */
export function isValidStatus(val: unknown): val is Status {
  return typeof val === "string" && VALID_STATUSES.includes(val as Status)
}

/** Check if a value is valid AISessionData */
export function isValidAISessionData(val: unknown): val is AISessionData {
  if (typeof val !== "object" || val === null) return false

  const backend = (val as { backend?: unknown }).backend
  if (backend !== "opencode" && backend !== "claude" && backend !== "codex") return false

  const sessionId = (val as { sessionId?: unknown }).sessionId
  if (sessionId !== undefined && typeof sessionId !== "string") return false

  const sessionTitle = (val as { sessionTitle?: unknown }).sessionTitle
  if (sessionTitle !== undefined && typeof sessionTitle !== "string") return false

  return true
}
