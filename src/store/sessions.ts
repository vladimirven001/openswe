/**
 * Session database operations
 *
 * CRUD operations for managing sessions in the database.
 */

import { getDatabase, nowISO } from "./db"
import { generateId } from "../utils/id"
import type {
  Session,
  CreateSessionInput,
  UpdateSessionInput,
  Phase,
  Status,
  AISessionData,
} from "./types"
import { isValidAISessionData } from "./types"
import { logger } from "../utils/logger"

// ============================================================================
// Database Row Type
// ============================================================================

interface SessionRow {
  id: string
  name: string
  issue_number: number | null
  issue_title: string | null
  issue_body: string | null
  issue_url: string | null
  worktree_path: string
  branch_name: string
  phase: string
  status: string
  attention_reason: string | null
  retry_count: number
  tokens_used: number
  pid: number | null
  ai_session_data: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// Row Mapping
// ============================================================================

/**
 * Convert database row to Session
 */
function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    name: row.name,
    issueNumber: row.issue_number,
    issueTitle: row.issue_title,
    issueBody: row.issue_body,
    issueUrl: row.issue_url,
    worktreePath: row.worktree_path,
    branchName: row.branch_name,
    phase: row.phase as Phase,
    status: row.status as Status,
    attentionReason: row.attention_reason,
    retryCount: row.retry_count,
    tokensUsed: row.tokens_used,
    pid: row.pid,
    aiSessionData: parseAISessionData(row.ai_session_data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Parse AI session data JSON
 */
function parseAISessionData(data: string | null): AISessionData | null {
  if (!data) return null
  try {
    const parsed = JSON.parse(data)
    if (!isValidAISessionData(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Serialize AI session data to JSON
 */
function serializeAISessionData(data: AISessionData | null | undefined): string | null {
  if (!data) return null
  return JSON.stringify(data)
}

// ============================================================================
// Query Operations
// ============================================================================

/**
 * Get all sessions
 */
export function getAllSessions(): Session[] {
  const db = getDatabase()
  const rows = db.query<SessionRow, []>("SELECT * FROM sessions ORDER BY created_at DESC").all()
  return rows.map(rowToSession)
}

/**
 * Get a session by ID
 *
 * @param id - Session UUID
 * @returns Session or null if not found
 */
export function getSession(id: string): Session | null {
  const db = getDatabase()
  const row = db
    .query<SessionRow, [string]>("SELECT * FROM sessions WHERE id = ?")
    .get(id)

  return row ? rowToSession(row) : null
}

/**
 * Get sessions by status
 *
 * @param status - Status to filter by
 */
export function getSessionsByStatus(status: Status): Session[] {
  const db = getDatabase()
  const rows = db
    .query<SessionRow, [string]>(
      "SELECT * FROM sessions WHERE status = ? ORDER BY created_at DESC"
    )
    .all(status)

  return rows.map(rowToSession)
}

/**
 * Get sessions by phase
 *
 * @param phase - Phase to filter by
 */
export function getSessionsByPhase(phase: Phase): Session[] {
  const db = getDatabase()
  const rows = db
    .query<SessionRow, [string]>(
      "SELECT * FROM sessions WHERE phase = ? ORDER BY created_at DESC"
    )
    .all(phase)

  return rows.map(rowToSession)
}

/**
 * Get count of active sessions
 */
export function getActiveSessionCount(): number {
  const db = getDatabase()
  const result = db
    .query<{ count: number }, []>(
      "SELECT COUNT(*) as count FROM sessions WHERE status = 'active'"
    )
    .get()

  return result?.count ?? 0
}

/**
 * Get count of all sessions
 */
export function getSessionCount(): number {
  const db = getDatabase()
  const result = db
    .query<{ count: number }, []>("SELECT COUNT(*) as count FROM sessions")
    .get()

  return result?.count ?? 0
}

// ============================================================================
// Create Operations
// ============================================================================

/**
 * Create a new session
 *
 * @param data - Session creation data
 * @returns The created Session
 */
export function createSession(data: CreateSessionInput): Session {
  const db = getDatabase()
  const id = generateId()
  const now = nowISO()
  const aiSessionData = serializeAISessionData(data.aiSessionData ?? null)

  logger.debug("Creating session", {
    id,
    name: data.name,
    issueNumber: data.issueNumber ?? null,
    worktreePath: data.worktreePath,
  })

  db.query(
    `INSERT INTO sessions (
      id, name, issue_number, issue_title, issue_body, issue_url,
      worktree_path, branch_name, phase, status,
      attention_reason, retry_count, tokens_used, pid, ai_session_data,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'queued', NULL, 0, 0, NULL, ?, ?, ?)`
  ).run(
    id,
    data.name,
    data.issueNumber ?? null,
    data.issueTitle ?? null,
    data.issueBody ?? null,
    data.issueUrl ?? null,
    data.worktreePath,
    data.branchName,
    aiSessionData,
    now,
    now
  )

  logger.debug("Session created", { id })

  return {
    id,
    name: data.name,
    issueNumber: data.issueNumber ?? null,
    issueTitle: data.issueTitle ?? null,
    issueBody: data.issueBody ?? null,
    issueUrl: data.issueUrl ?? null,
    worktreePath: data.worktreePath,
    branchName: data.branchName,
    phase: "pending",
    status: "queued",
    attentionReason: null,
    retryCount: 0,
    tokensUsed: 0,
    pid: null,
    aiSessionData: data.aiSessionData ?? null,
    createdAt: now,
    updatedAt: now,
  }
}

// ============================================================================
// Update Operations
// ============================================================================

/**
 * Update a session
 *
 * @param id - Session ID
 * @param data - Fields to update
 * @returns Updated Session
 * @throws Error if session not found
 */
export function updateSession(id: string, data: UpdateSessionInput): Session {
  const db = getDatabase()
  const now = nowISO()

  // Build dynamic update query
  const updates: string[] = ["updated_at = ?"]
  const values: (string | number | null)[] = [now]

  if (data.name !== undefined) {
    updates.push("name = ?")
    values.push(data.name)
  }
  if (data.phase !== undefined) {
    updates.push("phase = ?")
    values.push(data.phase)
  }
  if (data.status !== undefined) {
    updates.push("status = ?")
    values.push(data.status)
  }

  const shouldClearAttention =
    data.status !== undefined &&
    data.status !== "needs_attention" &&
    data.attentionReason === undefined

  if (data.attentionReason !== undefined) {
    updates.push("attention_reason = ?")
    values.push(data.attentionReason)
  } else if (shouldClearAttention) {
    updates.push("attention_reason = NULL")
  }
  if (data.retryCount !== undefined) {
    updates.push("retry_count = ?")
    values.push(data.retryCount)
  }
  if (data.tokensUsed !== undefined) {
    updates.push("tokens_used = ?")
    values.push(data.tokensUsed)
  }
  if (data.pid !== undefined) {
    updates.push("pid = ?")
    values.push(data.pid)
  }
  if (data.aiSessionData !== undefined) {
    updates.push("ai_session_data = ?")
    values.push(serializeAISessionData(data.aiSessionData))
  }

  values.push(id)

  db.query(`UPDATE sessions SET ${updates.join(", ")} WHERE id = ?`).run(...values)

  const session = getSession(id)
  if (!session) {
    throw new Error(`Session not found: ${id}`)
  }

  return session
}

/**
 * Update session phase
 *
 * @param id - Session ID
 * @param phase - New phase
 */
export function updateSessionPhase(id: string, phase: Phase): void {
  updateSession(id, { phase })
}

/**
 * Update session status
 *
 * @param id - Session ID
 * @param status - New status
 * @param reason - Optional attention reason (for needs_attention status)
 */
export function updateSessionStatus(
  id: string,
  status: Status,
  reason?: string
): void {
  updateSession(id, {
    status,
    attentionReason: status === "needs_attention" ? reason ?? null : null,
  })
}

/**
 * Increment retry count and return new value
 *
 * @param id - Session ID
 * @returns New retry count
 */
export function incrementRetryCount(id: string): number {
  const db = getDatabase()
  const now = nowISO()

  db.query(
    "UPDATE sessions SET retry_count = retry_count + 1, updated_at = ? WHERE id = ?"
  ).run(now, id)

  const session = getSession(id)
  return session?.retryCount ?? 0
}

/**
 * Update tokens used
 *
 * @param id - Session ID
 * @param tokens - New total tokens used
 */
export function updateTokensUsed(id: string, tokens: number): void {
  const db = getDatabase()
  const now = nowISO()

  db.query("UPDATE sessions SET tokens_used = ?, updated_at = ? WHERE id = ?").run(
    tokens,
    now,
    id
  )
}

/**
 * Set the process ID for a session
 *
 * @param id - Session ID
 * @param pid - Process ID or null to clear
 */
export function setPid(id: string, pid: number | null): void {
  const db = getDatabase()
  const now = nowISO()

  db.query("UPDATE sessions SET pid = ?, updated_at = ? WHERE id = ?").run(
    pid,
    now,
    id
  )
}

/**
 * Set the AI session data for a session
 *
 * @param id - Session ID
 * @param data - AI session data or null to clear
 */
export function setAISessionData(id: string, data: AISessionData | null): void {
  const db = getDatabase()
  const now = nowISO()
  const serialized = serializeAISessionData(data)

  db.query("UPDATE sessions SET ai_session_data = ?, updated_at = ? WHERE id = ?").run(
    serialized,
    now,
    id
  )
}

/**
 * Get the AI session data for a session
 *
 * @param id - Session ID
 * @returns AISessionData or null
 */
export function getAISessionData(id: string): AISessionData | null {
  const session = getSession(id)
  return session?.aiSessionData ?? null
}

// ============================================================================
// Delete Operations
// ============================================================================

/**
 * Delete a session
 *
 * Note: This cascades to delete associated tasks and output buffers.
 *
 * @param id - Session ID
 */
export function deleteSession(id: string): void {
  const db = getDatabase()
  db.query("DELETE FROM sessions WHERE id = ?").run(id)
}

/**
 * Delete all sessions
 *
 * Warning: This cascades to delete all tasks and buffers.
 */
export function deleteAllSessions(): void {
  const db = getDatabase()
  db.query("DELETE FROM sessions").run()
}
