/**
 * Session utility functions
 *
 * Bridge functions connecting GitHub issues, git worktrees, and sessions.
 * These functions handle the complete workflow of creating and deleting sessions.
 */

import { createWorktree, removeWorktree } from "../git"
import { createSession, deleteSession, getSession } from "../store"
import { getWorktreePath, generateBranchName, sanitizeWorktreeName } from "../workspace/paths"
import type { GitHubIssue } from "../github"
import type { Session } from "../store"

// ============================================================================
// Types
// ============================================================================

/** Result of creating a session */
export interface CreateSessionResult {
  /** Whether the operation succeeded */
  success: boolean
  /** Created session (null if failed) */
  session: Session | null
  /** Error message if operation failed */
  error?: string
}

/** Result of deleting a session with worktree */
export interface DeleteSessionResult {
  /** Whether the operation succeeded */
  success: boolean
  /** Error message if operation failed */
  error?: string
}

// ============================================================================
// Session Creation
// ============================================================================

/**
 * Create a session from a GitHub issue
 *
 * This function:
 * 1. Creates a git worktree at `.worktrees/issue-{number}`
 * 2. Creates a session in the database linked to the issue
 *
 * @param projectRoot - Absolute path to the project root
 * @param issue - GitHub issue data
 * @returns Result with the created session or error
 */
export async function createSessionFromIssue(
  projectRoot: string,
  issue: GitHubIssue
): Promise<CreateSessionResult> {
  const worktreeName = issue.number

  // Create the worktree
  const worktreeResult = await createWorktree(projectRoot, worktreeName)
  if (!worktreeResult.success) {
    return {
      success: false,
      session: null,
      error: worktreeResult.error ?? "Failed to create worktree",
    }
  }

  // Create the session in the database
  try {
    const session = createSession({
      name: `#${issue.number}: ${issue.title}`,
      issueNumber: issue.number,
      issueTitle: issue.title,
      issueBody: issue.body ?? undefined,
      issueUrl: issue.url,
      worktreePath: worktreeResult.worktreePath!,
      branchName: worktreeResult.branchName!,
    })

    return {
      success: true,
      session,
    }
  } catch (err) {
    // Clean up the worktree if session creation fails
    await removeWorktree(projectRoot, worktreeName, { force: true, deleteBranch: true })

    return {
      success: false,
      session: null,
      error: err instanceof Error ? err.message : "Failed to create session",
    }
  }
}

/**
 * Create a manual session (not linked to a GitHub issue)
 *
 * This function:
 * 1. Creates a git worktree at `.worktrees/{name}`
 * 2. Creates a session in the database
 *
 * @param projectRoot - Absolute path to the project root
 * @param name - Session name (will be sanitized for worktree)
 * @returns Result with the created session or error
 */
export async function createManualSession(
  projectRoot: string,
  name: string
): Promise<CreateSessionResult> {
  const sanitizedName = sanitizeWorktreeName(name)

  // Create the worktree
  const worktreeResult = await createWorktree(projectRoot, sanitizedName)
  if (!worktreeResult.success) {
    return {
      success: false,
      session: null,
      error: worktreeResult.error ?? "Failed to create worktree",
    }
  }

  // Create the session in the database
  try {
    const session = createSession({
      name,
      worktreePath: worktreeResult.worktreePath!,
      branchName: worktreeResult.branchName!,
    })

    return {
      success: true,
      session,
    }
  } catch (err) {
    // Clean up the worktree if session creation fails
    await removeWorktree(projectRoot, sanitizedName, { force: true, deleteBranch: true })

    return {
      success: false,
      session: null,
      error: err instanceof Error ? err.message : "Failed to create session",
    }
  }
}

// ============================================================================
// Session Deletion
// ============================================================================

/**
 * Delete a session and its associated worktree
 *
 * This function:
 * 1. Gets the session to find the worktree path
 * 2. Removes the git worktree
 * 3. Deletes the session from the database
 *
 * @param projectRoot - Absolute path to the project root
 * @param sessionId - Session UUID
 * @returns Result indicating success or failure
 */
export async function deleteSessionWithWorktree(
  projectRoot: string,
  sessionId: string
): Promise<DeleteSessionResult> {
  // Get the session to find worktree info
  const session = getSession(sessionId)
  if (!session) {
    return {
      success: false,
      error: "Session not found",
    }
  }

  // Determine worktree name from session
  let worktreeName: string | number
  if (session.issueNumber !== null) {
    worktreeName = session.issueNumber
  } else {
    // Extract from worktree path or branch name
    const pathParts = session.worktreePath.split("/")
    worktreeName = pathParts[pathParts.length - 1] ?? session.branchName.replace("openswe/", "")
  }

  // Remove the worktree (force to handle uncommitted changes)
  const worktreeResult = await removeWorktree(projectRoot, worktreeName, {
    force: true,
    deleteBranch: true,
  })

  if (!worktreeResult.success) {
    // Log the error but continue to delete the session
    // The worktree might already be gone
    console.error(`Warning: Failed to remove worktree: ${worktreeResult.error}`)
  }

  // Delete the session from the database
  try {
    deleteSession(sessionId)
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete session",
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract worktree name from a session
 *
 * @param session - Session to extract name from
 * @returns Worktree name (issue number or sanitized name)
 */
export function getWorktreeNameFromSession(session: Session): string | number {
  if (session.issueNumber !== null) {
    return session.issueNumber
  }

  // Extract from worktree path
  const pathParts = session.worktreePath.split("/")
  return pathParts[pathParts.length - 1] ?? session.branchName.replace("openswe/", "")
}
