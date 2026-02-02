/**
 * Git worktree management
 *
 * Provides functions for creating, listing, and removing git worktrees.
 * Worktrees allow multiple working directories from a single repository,
 * enabling parallel work on different issues.
 */

import { getWorktreesDir, getWorktreePath, generateBranchName, WORKTREES_DIR } from "../workspace/paths"
import { logger } from "../utils/logger"

// ============================================================================
// Types
// ============================================================================

/** Information about a git worktree */
export interface Worktree {
  /** Absolute path to the worktree directory */
  path: string
  /** Current HEAD commit SHA */
  head: string
  /** Branch name (null for detached HEAD) */
  branch: string | null
  /** Whether this is the main worktree */
  isMain: boolean
}

/** Result of a worktree operation */
export interface WorktreeResult {
  /** Whether the operation succeeded */
  success: boolean
  /** Error message if operation failed */
  error?: string
  /** Path to the created worktree (for create operations) */
  worktreePath?: string
  /** Branch name (for create operations) */
  branchName?: string
}

// ============================================================================
// Directory Setup
// ============================================================================

/**
 * Ensure the .worktrees directory exists
 *
 * @param projectRoot - Absolute path to the project root
 */
export async function ensureWorktreesDir(projectRoot: string): Promise<void> {
  const worktreesDir = getWorktreesDir(projectRoot)

  // Create directory if it doesn't exist
  const { mkdir } = await import("fs/promises")
  await mkdir(worktreesDir, { recursive: true })
}

// ============================================================================
// Worktree Operations
// ============================================================================

/**
 * Create a new git worktree with a new branch
 *
 * Creates a worktree at `.worktrees/{name}` with branch `openswe/{name}`.
 *
 * @param projectRoot - Absolute path to the project root
 * @param name - Worktree name (issue number or custom name)
 * @returns Result indicating success or failure
 */
export async function createWorktree(
  projectRoot: string,
  name: string | number
): Promise<WorktreeResult> {
  // Ensure .worktrees directory exists
  await ensureWorktreesDir(projectRoot)

  const worktreePath = getWorktreePath(projectRoot, name)
  const branchName = generateBranchName(name)

  logger.debug("Creating worktree", {
    projectRoot,
    worktreePath,
    branchName,
  })

  // Check if worktree already exists
  const exists = await worktreeExists(projectRoot, name)
  if (exists) {
    logger.warn("Worktree already exists", worktreePath)
    return {
      success: false,
      error: `Worktree already exists: ${worktreePath}`,
    }
  }

  try {
    // Create the worktree with a new branch
    // git worktree add <path> -b <branch>
    const proc = Bun.spawn(
      ["git", "worktree", "add", worktreePath, "-b", branchName],
      {
        cwd: projectRoot,
        stdout: "pipe",
        stderr: "pipe",
      }
    )

    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      // Parse common errors
      if (stderr.includes("already exists")) {
        // Branch might exist, try without -b flag
        logger.warn("Branch exists, retrying worktree creation", branchName)
        const retryProc = Bun.spawn(
          ["git", "worktree", "add", worktreePath, branchName],
          {
            cwd: projectRoot,
            stdout: "pipe",
            stderr: "pipe",
          }
        )

        const retryStderr = await new Response(retryProc.stderr).text()
        const retryExitCode = await retryProc.exited

        if (retryExitCode !== 0) {
          logger.warn("Worktree creation retry failed", retryStderr.trim())
          return {
            success: false,
            error: retryStderr.trim() || "Failed to create worktree",
          }
        }
      } else {
        logger.warn("Worktree creation failed", stderr.trim())
        return {
          success: false,
          error: stderr.trim() || "Failed to create worktree",
        }
      }
    }

    return {
      success: true,
      worktreePath,
      branchName,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create worktree",
    }
  }
}

/**
 * List all worktrees for a repository
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Array of worktree information
 */
export async function listWorktrees(projectRoot: string): Promise<Worktree[]> {
  try {
    const proc = Bun.spawn(
      ["git", "worktree", "list", "--porcelain"],
      {
        cwd: projectRoot,
        stdout: "pipe",
        stderr: "pipe",
      }
    )

    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      return []
    }

    // Parse porcelain output
    // Format:
    // worktree /path/to/worktree
    // HEAD <sha>
    // branch refs/heads/branch-name
    // <blank line>
    const worktrees: Worktree[] = []
    const entries = stdout.split("\n\n").filter((e) => e.trim())

    for (const entry of entries) {
      const lines = entry.split("\n")
      let path = ""
      let head = ""
      let branch: string | null = null
      let isMain = false

      for (const line of lines) {
        if (line.startsWith("worktree ")) {
          path = line.slice(9)
        } else if (line.startsWith("HEAD ")) {
          head = line.slice(5)
        } else if (line.startsWith("branch ")) {
          // refs/heads/branch-name -> branch-name
          branch = line.slice(7).replace("refs/heads/", "")
        } else if (line === "bare") {
          isMain = true
        }
      }

      // Main worktree is the one that's not in .worktrees
      if (path && !path.includes(`/${WORKTREES_DIR}/`)) {
        isMain = true
      }

      if (path && head) {
        worktrees.push({ path, head, branch, isMain })
      }
    }

    return worktrees
  } catch {
    return []
  }
}

/**
 * Remove a git worktree
 *
 * @param projectRoot - Absolute path to the project root
 * @param name - Worktree name (issue number or custom name)
 * @param options - Remove options
 * @returns Result indicating success or failure
 */
export async function removeWorktree(
  projectRoot: string,
  name: string | number,
  options?: {
    /** Force removal even if there are uncommitted changes */
    force?: boolean
    /** Also delete the associated branch */
    deleteBranch?: boolean
  }
): Promise<WorktreeResult> {
  const worktreePath = getWorktreePath(projectRoot, name)
  const branchName = generateBranchName(name)
  const { force = false, deleteBranch = true } = options ?? {}

  try {
    // Remove the worktree
    const args = ["git", "worktree", "remove", worktreePath]
    if (force) {
      args.push("--force")
    }

    const proc = Bun.spawn(args, {
      cwd: projectRoot,
      stdout: "pipe",
      stderr: "pipe",
    })

    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      // If directory doesn't exist, that's fine
      if (stderr.includes("is not a working tree") || stderr.includes("No such file")) {
        // Continue to branch deletion if requested
      } else {
        return {
          success: false,
          error: stderr.trim() || "Failed to remove worktree",
        }
      }
    }

    // Delete the branch if requested
    if (deleteBranch) {
      const branchArgs = ["git", "branch", "-D", branchName]
      const branchProc = Bun.spawn(branchArgs, {
        cwd: projectRoot,
        stdout: "pipe",
        stderr: "pipe",
      })

      // Don't fail if branch doesn't exist
      await branchProc.exited
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to remove worktree",
    }
  }
}

/**
 * Check if a worktree exists
 *
 * @param projectRoot - Absolute path to the project root
 * @param name - Worktree name (issue number or custom name)
 * @returns True if worktree exists
 */
export async function worktreeExists(
  projectRoot: string,
  name: string | number
): Promise<boolean> {
  const worktreePath = getWorktreePath(projectRoot, name)

  try {
    const worktrees = await listWorktrees(projectRoot)
    return worktrees.some((wt) => wt.path === worktreePath)
  } catch {
    return false
  }
}
