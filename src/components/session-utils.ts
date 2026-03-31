/**
 * Session utility functions
 *
 * Bridge functions connecting GitHub issues, git worktrees, and sessions.
 * These functions handle the complete workflow of creating and deleting sessions.
 */

import { createWorktree, removeWorktree, worktreeExists } from "../git"
import { createSession, deleteSession, getSession } from "../store"
import { getWorktreePath, generateBranchName, sanitizeWorktreeName } from "../workspace/paths"
import type { GitHubIssue } from "../github"
import type { Session, AISessionData } from "../store"
import { logger } from "../utils/logger"
import { existsSync } from "fs"

// ============================================================================
// Types
// ============================================================================

/** Options for creating a session from an issue */
export interface CreateSessionOptions {
	/**
	 * Custom worktree name to use instead of the issue number.
	 * Useful when resolving conflicts by appending a suffix.
	 */
	worktreeNameOverride?: string
	
	/**
	 * Whether to overwrite an existing worktree if it exists.
	 * If false (default), will fail if worktree exists.
	 */
	overwriteWorktreeChoice?: OverwriteWorktreeChoice

	/**
	 * Initial AI session data (e.g. backend provider)
	 */
	aiSessionData?: AISessionData
}

export enum OverwriteWorktreeChoice {
	use_existing = 0,
	create_new = 1,
	overwrite = 2
}

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
 * Find the next available worktree name by appending a counter
 * 
 * @param projectRoot - Absolute path to the project root
 * @param baseName - Base name (e.g. issue number)
 * @returns Available name (e.g. "issue-123", "issue-123-1")
 */
export async function findNextAvailableWorktreeName(
	projectRoot: string,
	baseName: string | number
): Promise<string> {
	// Get the canonical folder name first (e.g. 123 -> "issue-123")
	const safeBase = sanitizeWorktreeName(baseName)
	
	// First check the base name
	if (!(await worktreeExists(projectRoot, safeBase))) {
		return safeBase
	}
	
	// Try appending counters until we find a free one
	let counter = 1
	while (true) {
		const candidate = `${safeBase}-${counter}`
		if (!(await worktreeExists(projectRoot, candidate))) {
			return candidate
		}
		counter++
	}
}

/**
 * Create a session from a GitHub issue
 *
 * This function:
 * 1. Creates a git worktree at `.worktrees/issue-{number}`
 * 2. Creates a session in the database linked to the issue
 *
 * @param projectRoot - Absolute path to the project root
 * @param issue - GitHub issue data
 * @param options - Creation options (optional)
 * @returns Result with the created session or error
 */
export async function createSessionFromIssue(
	projectRoot: string,
	issue: GitHubIssue,
	options: CreateSessionOptions = {}
): Promise<CreateSessionResult> {
	const worktreeName = options.worktreeNameOverride ?? issue.number

	logger.debug("Creating worktree for issue", {
		issueNumber: issue.number,
		worktreeName,
		projectRoot,
		overwriteChoice: options.overwriteWorktreeChoice,
	})
	logger.info(options)
	logger.info(options.overwriteWorktreeChoice)

	let worktreePath: string
	let branchName: string

	if (options.overwriteWorktreeChoice === OverwriteWorktreeChoice.use_existing) {
		// Continue with existing worktree -- but verify it actually exists on disk
		worktreePath = getWorktreePath(projectRoot, worktreeName)
		branchName = generateBranchName(worktreeName)

		if (!existsSync(worktreePath)) {
			logger.warn("use_existing selected but worktree directory missing on disk", { worktreePath })
			return {
				success: false,
				session: null,
				error: `Worktree directory does not exist: ${worktreePath}. It may have been deleted. Try creating a new worktree instead.`,
			}
		}
	} else {
		// Handle overwrite if requested
		if (options.overwriteWorktreeChoice === OverwriteWorktreeChoice.overwrite) {
			const exists = await worktreeExists(projectRoot, worktreeName)
			if (exists) {
				logger.info("Overwriting existing worktree", { worktreeName })
				await removeWorktree(projectRoot, worktreeName, { force: true, deleteBranch: true })
			}
		}

		// Create the worktree
		const worktreeResult = await createWorktree(projectRoot, worktreeName)
		if (!worktreeResult.success) {
			logger.warn("Worktree creation failed", worktreeResult.error)
			return {
				success: false,
				session: null,
				error: worktreeResult.error ?? "Failed to create worktree",
			}
		}

		worktreePath = worktreeResult.worktreePath!
		branchName = worktreeResult.branchName!
	}

	// Create the session in the database
	try {
		const session = createSession({
			name: `#${issue.number}: ${issue.title}`,
			issueNumber: issue.number,
			issueTitle: issue.title,
			issueBody: issue.body ?? undefined,
			issueComments: issue.comments,
			issueUrl: issue.url,
			worktreePath,
			branchName,
			aiSessionData: options.aiSessionData,
		})

		logger.debug("Session created", {
			sessionId: session.id,
			issueNumber: issue.number,
		})

		return {
			success: true,
			session,
		}
	} catch (err) {
		// Clean up the worktree if session creation fails
		logger.warn("Session creation failed, cleaning up worktree", err)
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
 * @param options - Creation options (optional)
 * @returns Result with the created session or error
 */
export async function createManualSession(
	projectRoot: string,
	name: string,
	options: { aiSessionData?: AISessionData } = {}
): Promise<CreateSessionResult> {
	const sanitizedName = sanitizeWorktreeName(name)

	logger.debug("Creating manual session", {
		name,
		sanitizedName,
		projectRoot,
	})

	// Create the worktree
	const worktreeResult = await createWorktree(projectRoot, sanitizedName)
	if (!worktreeResult.success) {
		logger.warn("Worktree creation failed", worktreeResult.error)
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
			aiSessionData: options.aiSessionData,
		})

		logger.debug("Manual session created", { sessionId: session.id })

		return {
			success: true,
			session,
		}
	} catch (err) {
		// Clean up the worktree if session creation fails
		logger.warn("Manual session creation failed, cleaning up worktree", err)
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

	// Derive the worktree name from the stored worktree path (last segment).
	// This is more reliable than re-deriving from issueNumber, because the
	// actual worktree may have a suffix (e.g. "issue-123-1") from conflict
	// resolution that would be lost if we computed from the issue number alone.
	const pathParts = session.worktreePath.split("/")
	const worktreeName = pathParts[pathParts.length - 1] ?? session.branchName.replace("openswe/", "")

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
export function getWorktreeNameFromSession(session: Session): string {
	// Always derive from the stored worktree path (last segment) rather than
	// re-computing from issueNumber, to correctly handle suffixed names like
	// "issue-123-1" from conflict resolution.
	const pathParts = session.worktreePath.split("/")
	return pathParts[pathParts.length - 1] ?? session.branchName.replace("openswe/", "")
}
