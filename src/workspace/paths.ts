/**
 * Path utilities for workspace directories
 *
 * Provides consistent path resolution for OpenSWE project structure:
 * - .openswe/        - Project state directory
 * - .openswe/state.db - SQLite database
 * - .openswe/logs/   - Log files
 * - .worktrees/      - Git worktrees for sessions
 */

import { join, resolve } from "path"

// ============================================================================
// Directory Names (Constants)
// ============================================================================

/** Name of the OpenSWE project state directory */
export const OPENSWE_DIR = ".openswe"

/** Name of the worktrees directory */
export const WORKTREES_DIR = ".worktrees"

/** Name of the SQLite database file */
export const STATE_DB_FILE = "state.db"

/** Name of the logs directory within .openswe */
export const LOGS_DIR = "logs"

// ============================================================================
// Path Resolution Functions
// ============================================================================

/**
 * Resolve the .openswe directory path for a project root
 * @param projectRoot - Absolute path to the project root
 */
export function getOpenSWEDir(projectRoot: string): string {
  return join(projectRoot, OPENSWE_DIR)
}

/**
 * Resolve the .worktrees directory path for a project root
 * @param projectRoot - Absolute path to the project root
 */
export function getWorktreesDir(projectRoot: string): string {
  return join(projectRoot, WORKTREES_DIR)
}

/**
 * Resolve the state.db path for a project root
 * @param projectRoot - Absolute path to the project root
 */
export function getStateDatabasePath(projectRoot: string): string {
  return join(projectRoot, OPENSWE_DIR, STATE_DB_FILE)
}

/**
 * Resolve the logs directory path for a project root
 * @param projectRoot - Absolute path to the project root
 */
export function getLogsDir(projectRoot: string): string {
  return join(projectRoot, OPENSWE_DIR, LOGS_DIR)
}

/**
 * Resolve a worktree path for a specific session/issue
 * @param projectRoot - Absolute path to the project root
 * @param name - Session name or issue number (will be sanitized)
 */
export function getWorktreePath(projectRoot: string, name: string | number): string {
  const sanitized = sanitizeWorktreeName(name)
  return join(projectRoot, WORKTREES_DIR, sanitized)
}


/**
 * Resolve the log file path for a session
 * @param projectRoot - Absolute path to the project root
 * @param sessionId - Session UUID
 */
export function getSessionLogPath(projectRoot: string, sessionId: string): string {
  return join(getLogsDir(projectRoot), `${sessionId}.log`)
}

// ============================================================================
// Naming Utilities
// ============================================================================

/**
 * Sanitize a name for use as a worktree directory/branch name
 * - Converts to lowercase
 * - Replaces spaces and special chars with hyphens
 * - Removes consecutive hyphens
 * - Trims leading/trailing hyphens
 */
export function sanitizeWorktreeName(name: string | number): string {
  if (typeof name === "number") {
    return `issue-${name}`
  }

  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/-+/g, "-")         // Collapse multiple hyphens
    .replace(/^-|-$/g, "")       // Trim leading/trailing hyphens
}

/**
 * Generate a branch name for a session
 * @param name - Session name or issue number
 * @param prefix - Branch prefix (default: "openswe")
 */
export function generateBranchName(name: string | number, prefix = "openswe"): string {
  const sanitized = sanitizeWorktreeName(name)
  return `${prefix}/${sanitized}`
}

// ============================================================================
// Path Validation
// ============================================================================

/**
 * Ensure a path is absolute
 * @param path - Path to validate/resolve
 * @param basePath - Base path for resolution if relative (defaults to cwd)
 */
export function ensureAbsolutePath(path: string, basePath?: string): string {
  if (path.startsWith("/")) {
    return path
  }
  return resolve(basePath ?? process.cwd(), path)
}

/**
 * Check if a path is inside another path
 * @param child - Potential child path
 * @param parent - Potential parent path
 */
export function isPathInside(child: string, parent: string): boolean {
  const resolvedChild = resolve(child)
  const resolvedParent = resolve(parent)
  return resolvedChild.startsWith(resolvedParent + "/") || resolvedChild === resolvedParent
}
