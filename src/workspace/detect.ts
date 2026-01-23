/**
 * Workspace detection logic
 *
 * Detects the workspace type based on what exists in the current directory:
 * - existing-project: Has .openswe/ directory (fully initialized)
 * - existing-repo: Has .git/ but no .openswe/ (can be adopted)
 * - empty: No relevant markers (needs full setup)
 */

import { dirname, join, resolve } from "path"
import { getOpenSWEDir } from "./paths"

// ============================================================================
// Types
// ============================================================================

/** Types of workspace states we can detect */
export type WorkspaceType =
  | "existing-project"  // Has .openswe/ - load and continue
  | "existing-repo"     // Has .git/ but no .openswe/ - offer to adopt
  | "empty"             // Empty or no relevant markers - need setup

/** Result of workspace detection */
export interface WorkspaceResult {
  /** The detected workspace type */
  type: WorkspaceType
  /** Absolute path to the project root */
  projectRoot: string
  /** Git remote URL (only for existing-repo type) */
  remoteUrl?: string | null
  /** Repository full name in owner/repo format (only for existing-repo type) */
  repoFullName?: string | null
}

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Check if a directory contains an OpenSWE project
 * @param path - Directory path to check
 */
export async function hasOpenSWEProject(path: string): Promise<boolean> {
  const opensweDir = getOpenSWEDir(path)
  // Try to check if it's a directory by checking if state.db exists
  // or if the directory marker exists
  try {
    const { readdir } = await import("fs/promises")
    await readdir(opensweDir)
    return true
  } catch {
    return false
  }
}

/**
 * Check if a directory contains a git repository
 * @param path - Directory path to check
 */
export async function hasGitRepo(path: string): Promise<boolean> {
  const gitDir = join(path, ".git")
  try {
    const { readdir } = await import("fs/promises")
    await readdir(gitDir)
    return true
  } catch {
    // .git might be a file (for worktrees), check if it exists as a file
    const gitFile = Bun.file(gitDir)
    return gitFile.exists()
  }
}

/**
 * Check if a directory is empty (or only contains hidden files we can ignore)
 * @param path - Directory path to check
 */
export async function isEmptyDirectory(path: string): Promise<boolean> {
  try {
    const { readdir } = await import("fs/promises")
    const entries = await readdir(path)
    // Consider empty if no entries or only .DS_Store
    const significantEntries = entries.filter(
      (e) => e !== ".DS_Store" && e !== ".gitkeep"
    )
    return significantEntries.length === 0
  } catch {
    return false
  }
}

/**
 * Get the git remote origin URL
 * @param path - Directory path (must contain .git)
 * @returns Remote URL or null if not found
 */
export async function getGitRemoteUrl(path: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["git", "remote", "get-url", "origin"], {
      cwd: path,
      stdout: "pipe",
      stderr: "pipe",
    })

    const output = await new Response(proc.stdout).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      return null
    }

    return output.trim() || null
  } catch {
    return null
  }
}

/**
 * Parse a git remote URL to extract owner/repo format
 * Handles both HTTPS and SSH URLs:
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - https://github.com/owner/repo
 * - git@github.com:owner/repo
 *
 * @param remoteUrl - Git remote URL
 * @returns owner/repo string or null if parsing fails
 */
export function parseRepoFullName(remoteUrl: string): string | null {
  // SSH format: git@github.com:owner/repo.git
  const sshMatch = remoteUrl.match(/git@[^:]+:([^/]+\/[^/]+?)(?:\.git)?$/)
  if (sshMatch?.[1]) {
    return sshMatch[1]
  }

  // HTTPS format: https://github.com/owner/repo.git
  const httpsMatch = remoteUrl.match(/https?:\/\/[^/]+\/([^/]+\/[^/]+?)(?:\.git)?$/)
  if (httpsMatch?.[1]) {
    return httpsMatch[1]
  }

  return null
}

/**
 * Main workspace detection function
 *
 * Detection logic follows this order:
 * 1. Check for .openswe/ (existing project) → load and continue
 * 2. Check for .git/ (existing repo) → offer to adopt
 * 3. Otherwise → empty directory, need full setup
 *
 * @param cwd - Current working directory to detect
 * @returns Detection result with workspace type and relevant info
 */
export async function detectWorkspace(cwd: string): Promise<WorkspaceResult> {
  let current = resolve(cwd)

  while (true) {
    // Prefer OpenSWE project if found at this level
    if (await hasOpenSWEProject(current)) {
      return {
        type: "existing-project",
        projectRoot: current,
      }
    }

    // Otherwise see if this level is a git repo
    if (await hasGitRepo(current)) {
      const remoteUrl = await getGitRemoteUrl(current)
      const repoFullName = remoteUrl ? parseRepoFullName(remoteUrl) : null

      return {
        type: "existing-repo",
        projectRoot: current,
        remoteUrl,
        repoFullName,
      }
    }

    const parent = dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }

  return {
    type: "empty",
    projectRoot: resolve(cwd),
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that a directory can be used as a workspace
 * - Must exist
 * - Must be a directory (not a file)
 * - Must be readable
 *
 * @param path - Path to validate
 * @throws Error if validation fails
 */
export async function validateWorkspaceDirectory(path: string): Promise<void> {
  const { stat } = await import("fs/promises")

  try {
    const stats = await stat(path)
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${path}`)
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Directory does not exist: ${path}`)
    }
    if ((err as NodeJS.ErrnoException).code === "EACCES") {
      throw new Error(`Permission denied: ${path}`)
    }
    throw err
  }
}
