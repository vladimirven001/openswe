/**
 * Output buffer database operations
 *
 * Manages circular buffers for session output storage.
 * Each session has a buffer that stores the most recent output lines.
 */

import { getDatabase, nowISO } from "./db"
import type { OutputBuffer } from "./types"

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of lines to store per buffer */
export const MAX_BUFFER_LINES = 1000

// ============================================================================
// Database Row Type
// ============================================================================

interface BufferRow {
  session_id: string
  lines: string
  last_updated: string
}

// ============================================================================
// Row Mapping
// ============================================================================

/**
 * Convert database row to OutputBuffer
 */
function rowToBuffer(row: BufferRow): OutputBuffer {
  let lines: string[]
  try {
    lines = JSON.parse(row.lines)
    if (!Array.isArray(lines)) {
      lines = []
    }
  } catch {
    lines = []
  }

  return {
    sessionId: row.session_id,
    lines,
    lastUpdated: row.last_updated,
  }
}

// ============================================================================
// Query Operations
// ============================================================================

/**
 * Get the output buffer for a session
 *
 * @param sessionId - Session UUID
 * @returns OutputBuffer or null if not found
 */
export function getBuffer(sessionId: string): OutputBuffer | null {
  const db = getDatabase()
  const row = db
    .query<BufferRow, [string]>(
      "SELECT * FROM output_buffers WHERE session_id = ?"
    )
    .get(sessionId)

  return row ? rowToBuffer(row) : null
}

/**
 * Get recent lines from a session's buffer
 *
 * @param sessionId - Session UUID
 * @param count - Number of recent lines to retrieve
 * @returns Array of lines (may be empty if buffer doesn't exist)
 */
export function getRecentLines(sessionId: string, count: number): string[] {
  const buffer = getBuffer(sessionId)
  if (!buffer) {
    return []
  }

  // Return last N lines
  return buffer.lines.slice(-count)
}

/**
 * Get all lines from a session's buffer
 *
 * @param sessionId - Session UUID
 * @returns Array of all lines
 */
export function getAllLines(sessionId: string): string[] {
  const buffer = getBuffer(sessionId)
  return buffer?.lines ?? []
}

// ============================================================================
// Create/Update Operations
// ============================================================================

/**
 * Create a new output buffer for a session
 *
 * @param sessionId - Session UUID
 * @returns The created OutputBuffer
 */
export function createBuffer(sessionId: string): OutputBuffer {
  const db = getDatabase()
  const now = nowISO()

  db.query(
    "INSERT INTO output_buffers (session_id, lines, last_updated) VALUES (?, '[]', ?)"
  ).run(sessionId, now)

  return {
    sessionId,
    lines: [],
    lastUpdated: now,
  }
}

/**
 * Ensure a buffer exists for a session (create if needed)
 *
 * @param sessionId - Session UUID
 * @returns The OutputBuffer
 */
export function ensureBuffer(sessionId: string): OutputBuffer {
  const existing = getBuffer(sessionId)
  if (existing) {
    return existing
  }
  return createBuffer(sessionId)
}

/**
 * Append lines to a session's output buffer
 *
 * Implements circular buffer logic - drops oldest lines when exceeding MAX_BUFFER_LINES.
 *
 * @param sessionId - Session UUID
 * @param newLines - Lines to append
 */
export function appendLines(sessionId: string, newLines: string[]): void {
  if (newLines.length === 0) {
    return
  }

  const db = getDatabase()
  const now = nowISO()

  // Ensure buffer exists
  const buffer = ensureBuffer(sessionId)

  // Combine existing and new lines
  let allLines = [...buffer.lines, ...newLines]

  // Apply circular buffer limit
  if (allLines.length > MAX_BUFFER_LINES) {
    allLines = allLines.slice(-MAX_BUFFER_LINES)
  }

  // Update in database
  db.query(
    "UPDATE output_buffers SET lines = ?, last_updated = ? WHERE session_id = ?"
  ).run(JSON.stringify(allLines), now, sessionId)
}

/**
 * Append a single line to a session's output buffer
 *
 * @param sessionId - Session UUID
 * @param line - Line to append
 */
export function appendLine(sessionId: string, line: string): void {
  appendLines(sessionId, [line])
}

/**
 * Replace all lines in a buffer
 *
 * @param sessionId - Session UUID
 * @param lines - New lines (will be truncated to MAX_BUFFER_LINES)
 */
export function setLines(sessionId: string, lines: string[]): void {
  const db = getDatabase()
  const now = nowISO()

  // Ensure buffer exists
  ensureBuffer(sessionId)

  // Apply limit
  const truncatedLines = lines.slice(-MAX_BUFFER_LINES)

  // Update in database
  db.query(
    "UPDATE output_buffers SET lines = ?, last_updated = ? WHERE session_id = ?"
  ).run(JSON.stringify(truncatedLines), now, sessionId)
}

// ============================================================================
// Delete Operations
// ============================================================================

/**
 * Clear all lines from a session's buffer
 *
 * @param sessionId - Session UUID
 */
export function clearBuffer(sessionId: string): void {
  const db = getDatabase()
  const now = nowISO()

  db.query(
    "UPDATE output_buffers SET lines = '[]', last_updated = ? WHERE session_id = ?"
  ).run(now, sessionId)
}

/**
 * Delete a session's buffer
 *
 * Note: This is also done automatically via CASCADE when session is deleted.
 *
 * @param sessionId - Session UUID
 */
export function deleteBuffer(sessionId: string): void {
  const db = getDatabase()
  db.query("DELETE FROM output_buffers WHERE session_id = ?").run(sessionId)
}
