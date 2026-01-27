/**
 * Database type definitions for OpenSWE
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

/** Types of human tasks that require intervention */
export type TaskType =
  | "question"
  | "permission"
  | "blocker"
  | "retry_failed"
  | "pr_review"

/** Priority levels for human tasks */
export type TaskPriority = "low" | "normal" | "high" | "critical"

/** Backend session reference for AI integrations */
export interface AISessionData {
  backend: "opencode" | "claude"
  sessionId?: string
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
  /** Pull request URL once created */
  prUrl: string | null
  /** Process ID if session is running */
  pid: number | null
  /** AI backend session reference data */
  aiSessionData: AISessionData | null
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
  prUrl?: string | null
  pid?: number | null
  aiSessionData?: AISessionData | null
}

// ============================================================================
// Human Task Types
// ============================================================================

/** A human task represents work requiring human intervention */
export interface HumanTask {
  /** Unique identifier (UUID) */
  id: string
  /** ID of the session this task belongs to */
  sessionId: string
  /** Session name (denormalized for display) */
  sessionName: string
  /** Issue number (denormalized for display) */
  issueNumber: number | null
  /** Type of intervention required */
  type: TaskType
  /** Priority level */
  priority: TaskPriority
  /** Brief title describing the task */
  title: string
  /** Additional context or details */
  context: string | null
  /** Raw AI output that triggered the task */
  rawOutput: string | null
  /** ISO timestamp when task was created */
  createdAt: string
  /** ISO timestamp when task was resolved (null if pending) */
  resolvedAt: string | null
}

/** Input for creating a new human task */
export interface CreateTaskInput {
  sessionId: string
  sessionName: string
  issueNumber?: number
  type: TaskType
  priority?: TaskPriority
  title: string
  context?: string
  rawOutput?: string
}

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

const VALID_TASK_TYPES: readonly TaskType[] = [
  "question",
  "permission",
  "blocker",
  "retry_failed",
  "pr_review",
]

const VALID_PRIORITIES: readonly TaskPriority[] = [
  "low",
  "normal",
  "high",
  "critical",
]

const VALID_AI_BACKENDS = ["opencode", "claude"] as const

/** Check if a value is a valid Phase */
export function isValidPhase(val: unknown): val is Phase {
  return typeof val === "string" && VALID_PHASES.includes(val as Phase)
}

/** Check if a value is a valid Status */
export function isValidStatus(val: unknown): val is Status {
  return typeof val === "string" && VALID_STATUSES.includes(val as Status)
}

/** Check if a value is a valid TaskType */
export function isValidTaskType(val: unknown): val is TaskType {
  return typeof val === "string" && VALID_TASK_TYPES.includes(val as TaskType)
}

/** Check if a value is a valid TaskPriority */
export function isValidTaskPriority(val: unknown): val is TaskPriority {
  return typeof val === "string" && VALID_PRIORITIES.includes(val as TaskPriority)
}

/** Check if a value is valid AISessionData */
export function isValidAISessionData(val: unknown): val is AISessionData {
  if (typeof val !== "object" || val === null) return false

  const backend = (val as { backend?: unknown }).backend
  if (backend !== "opencode" && backend !== "claude") return false

  const sessionId = (val as { sessionId?: unknown }).sessionId
  if (sessionId !== undefined && typeof sessionId !== "string") return false

  return true
}
