/**
 * Project state database operations
 *
 * Manages the project singleton in the database.
 * This mirrors essential fields from ProjectConfig for querying.
 */

import { getDatabase, nowISO } from "./db"
import type { ProjectState, CreateProjectInput } from "./types"

// ============================================================================
// Database Row Type
// ============================================================================

interface ProjectRow {
  id: number
  repo_full_name: string
  repo_url: string
  created_at: string
  last_opened_at: string
}

// ============================================================================
// Row Mapping
// ============================================================================

/**
 * Convert database row to ProjectState
 */
function rowToProject(row: ProjectRow): ProjectState {
  return {
    id: 1,
    repoFullName: row.repo_full_name,
    repoUrl: row.repo_url,
    createdAt: row.created_at,
    lastOpenedAt: row.last_opened_at,
  }
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get the project state from the database
 *
 * @returns ProjectState or null if not created
 */
export function getProject(): ProjectState | null {
  const db = getDatabase()
  const row = db
    .query<ProjectRow, []>("SELECT * FROM project WHERE id = 1")
    .get()

  return row ? rowToProject(row) : null
}

/**
 * Create the project state (singleton)
 *
 * @param data - Project creation data
 * @returns The created ProjectState
 * @throws Error if project already exists
 */
export function createProject(data: CreateProjectInput): ProjectState {
  const db = getDatabase()
  const now = nowISO()

  // Check if project already exists
  const existing = getProject()
  if (existing) {
    throw new Error("Project already exists. Use updateProject instead.")
  }

  db.query(
    `INSERT INTO project (id, repo_full_name, repo_url, created_at, last_opened_at)
     VALUES (1, ?, ?, ?, ?)`
  ).run(
    data.repoFullName,
    data.repoUrl,
    now,
    now
  )

  return {
    id: 1,
    repoFullName: data.repoFullName,
    repoUrl: data.repoUrl,
    createdAt: now,
    lastOpenedAt: now,
  }
}

/**
 * Update the lastOpenedAt timestamp
 */
export function updateLastOpened(): void {
  const db = getDatabase()
  const now = nowISO()

  db.query("UPDATE project SET last_opened_at = ? WHERE id = 1").run(now)
}

/**
 * Check if project exists in the database
 */
export function projectExists(): boolean {
  return getProject() !== null
}

/**
 * Delete the project state
 *
 * Warning: This also cascades to delete all sessions and tasks.
 */
export function deleteProject(): void {
  const db = getDatabase()
  db.query("DELETE FROM project WHERE id = 1").run()
}
