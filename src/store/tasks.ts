/**
 * Human task database operations
 *
 * CRUD operations for managing human intervention tasks in the database.
 */

import { getDatabase, nowISO } from "./db"
import { generateId } from "../utils/id"
import type { HumanTask, CreateTaskInput, TaskType, TaskPriority } from "./types"

// ============================================================================
// Database Row Type
// ============================================================================

interface TaskRow {
  id: string
  session_id: string
  session_name: string
  issue_number: number | null
  type: string
  priority: string
  title: string
  context: string | null
  raw_output: string | null
  created_at: string
  resolved_at: string | null
}

// ============================================================================
// Row Mapping
// ============================================================================

/**
 * Convert database row to HumanTask
 */
function rowToTask(row: TaskRow): HumanTask {
  return {
    id: row.id,
    sessionId: row.session_id,
    sessionName: row.session_name,
    issueNumber: row.issue_number,
    type: row.type as TaskType,
    priority: row.priority as TaskPriority,
    title: row.title,
    context: row.context,
    rawOutput: row.raw_output,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }
}

// ============================================================================
// Query Operations
// ============================================================================

/**
 * Get all tasks
 */
export function getAllTasks(): HumanTask[] {
  const db = getDatabase()
  const rows = db
    .query<TaskRow, []>("SELECT * FROM human_tasks ORDER BY created_at DESC")
    .all()

  return rows.map(rowToTask)
}

/**
 * Get a task by ID
 *
 * @param id - Task UUID
 * @returns HumanTask or null if not found
 */
export function getTask(id: string): HumanTask | null {
  const db = getDatabase()
  const row = db
    .query<TaskRow, [string]>("SELECT * FROM human_tasks WHERE id = ?")
    .get(id)

  return row ? rowToTask(row) : null
}

/**
 * Get all unresolved tasks
 */
export function getUnresolvedTasks(): HumanTask[] {
  const db = getDatabase()
  const rows = db
    .query<TaskRow, []>(
      "SELECT * FROM human_tasks WHERE resolved_at IS NULL ORDER BY created_at DESC"
    )
    .all()

  return rows.map(rowToTask)
}

/**
 * Get count of unresolved tasks
 */
export function getUnresolvedTaskCount(): number {
  const db = getDatabase()
  const result = db
    .query<{ count: number }, []>(
      "SELECT COUNT(*) as count FROM human_tasks WHERE resolved_at IS NULL"
    )
    .get()

  return result?.count ?? 0
}

/**
 * Get tasks by session ID
 *
 * @param sessionId - Session UUID
 */
export function getTasksBySession(sessionId: string): HumanTask[] {
  const db = getDatabase()
  const rows = db
    .query<TaskRow, [string]>(
      "SELECT * FROM human_tasks WHERE session_id = ? ORDER BY created_at DESC"
    )
    .all(sessionId)

  return rows.map(rowToTask)
}

/**
 * Get unresolved tasks by session ID
 *
 * @param sessionId - Session UUID
 */
export function getUnresolvedTasksBySession(sessionId: string): HumanTask[] {
  const db = getDatabase()
  const rows = db
    .query<TaskRow, [string]>(
      "SELECT * FROM human_tasks WHERE session_id = ? AND resolved_at IS NULL ORDER BY created_at DESC"
    )
    .all(sessionId)

  return rows.map(rowToTask)
}

/**
 * Get tasks by type
 *
 * @param type - Task type to filter by
 */
export function getTasksByType(type: TaskType): HumanTask[] {
  const db = getDatabase()
  const rows = db
    .query<TaskRow, [string]>(
      "SELECT * FROM human_tasks WHERE type = ? ORDER BY created_at DESC"
    )
    .all(type)

  return rows.map(rowToTask)
}

// ============================================================================
// Create Operations
// ============================================================================

/**
 * Create a new human task
 *
 * @param data - Task creation data
 * @returns The created HumanTask
 */
export function createTask(data: CreateTaskInput): HumanTask {
  const db = getDatabase()
  const id = generateId()
  const now = nowISO()
  const priority = data.priority ?? "normal"

  db.query(
    `INSERT INTO human_tasks (
      id, session_id, session_name, issue_number,
      type, priority, title, context, raw_output,
      created_at, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
  ).run(
    id,
    data.sessionId,
    data.sessionName,
    data.issueNumber ?? null,
    data.type,
    priority,
    data.title,
    data.context ?? null,
    data.rawOutput ?? null,
    now
  )

  return {
    id,
    sessionId: data.sessionId,
    sessionName: data.sessionName,
    issueNumber: data.issueNumber ?? null,
    type: data.type,
    priority,
    title: data.title,
    context: data.context ?? null,
    rawOutput: data.rawOutput ?? null,
    createdAt: now,
    resolvedAt: null,
  }
}

// ============================================================================
// Update Operations
// ============================================================================

/**
 * Mark a task as resolved
 *
 * @param id - Task ID
 */
export function resolveTask(id: string): void {
  const db = getDatabase()
  const now = nowISO()

  db.query("UPDATE human_tasks SET resolved_at = ? WHERE id = ?").run(now, id)
}

/**
 * Unresolve a task (set resolved_at back to null)
 *
 * @param id - Task ID
 */
export function unresolveTask(id: string): void {
  const db = getDatabase()
  db.query("UPDATE human_tasks SET resolved_at = NULL WHERE id = ?").run(id)
}

// ============================================================================
// Delete Operations
// ============================================================================

/**
 * Delete a task
 *
 * @param id - Task ID
 */
export function deleteTask(id: string): void {
  const db = getDatabase()
  db.query("DELETE FROM human_tasks WHERE id = ?").run(id)
}

/**
 * Delete all tasks for a session
 *
 * Note: This is also done automatically via CASCADE when session is deleted.
 *
 * @param sessionId - Session ID
 */
export function deleteTasksBySession(sessionId: string): void {
  const db = getDatabase()
  db.query("DELETE FROM human_tasks WHERE session_id = ?").run(sessionId)
}

/**
 * Delete all resolved tasks
 */
export function deleteResolvedTasks(): void {
  const db = getDatabase()
  db.query("DELETE FROM human_tasks WHERE resolved_at IS NOT NULL").run()
}
