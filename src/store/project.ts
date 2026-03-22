/**
 * Project state database operations
 *
 * Manages the project singleton in the database.
 * This mirrors essential fields from ProjectConfig for querying.
 */

import { getDatabase, nowISO } from "./db"
import type { ProjectState, CreateProjectInput, TicketProviderType } from "./types"
import { isTicketProviderType } from "./types"
import { logger } from "../utils/logger"

// ============================================================================
// Database Row Type
// ============================================================================

interface ProjectRow {
  id: number
  repo_full_name: string
  repo_url: string
  ticket_provider: string
  ticket_provider_config: string | null
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
  if (!isTicketProviderType(row.ticket_provider)) {
    logger.warn("Invalid ticket_provider in database", {
      value: row.ticket_provider,
    })
    throw new Error(`Invalid ticket_provider value in database: ${row.ticket_provider}`)
  }
  return {
    id: 1,
    repoFullName: row.repo_full_name,
    repoUrl: row.repo_url,
    ticketProvider: row.ticket_provider,
    ticketProviderConfig: row.ticket_provider_config,
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

  const ticketProvider = data.ticketProvider ?? "github"
  const ticketProviderConfig = data.ticketProviderConfig ?? null

  // Check if project already exists
  const existing = getProject()
  if (existing) {
    throw new Error("Project already exists. Use updateProject instead.")
  }

  db.query(
    `INSERT INTO project (id, repo_full_name, repo_url, ticket_provider, ticket_provider_config, created_at, last_opened_at)
     VALUES (1, ?, ?, ?, ?, ?, ?)`
  ).run(
    data.repoFullName,
    data.repoUrl,
    ticketProvider,
    ticketProviderConfig,
    now,
    now
  )

  return {
    id: 1,
    repoFullName: data.repoFullName,
    repoUrl: data.repoUrl,
    ticketProvider,
    ticketProviderConfig,
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
 * Update the ticket provider in the database
 *
 * @param provider - New ticket provider type
 */
export function updateProjectTicketProvider(provider: TicketProviderType): void {
  const db = getDatabase()
  db.query("UPDATE project SET ticket_provider = ?, ticket_provider_config = NULL WHERE id = 1").run(provider)
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