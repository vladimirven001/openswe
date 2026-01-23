/**
 * Git repository operations
 *
 * Handles cloning repositories and git-related checks.
 */

// ============================================================================
// Types
// ============================================================================

/** Clone protocol options */
export type CloneProtocol = "ssh" | "https"

/** Clone operation result */
export interface CloneResult {
  success: boolean
  error?: string
}

/** Clone options */
export interface CloneOptions {
  /** Protocol to use for cloning */
  protocol?: CloneProtocol
  /** Callback for progress messages */
  onProgress?: (message: string) => void
}

// ============================================================================
// Git Installation Check
// ============================================================================

/**
 * Check if git is installed and available
 */
export async function checkGitInstalled(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["git", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const exitCode = await proc.exited
    return exitCode === 0
  } catch {
    return false
  }
}

/**
 * Get the installed git version
 */
export async function getGitVersion(): Promise<string | null> {
  try {
    const proc = Bun.spawn(["git", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const output = await new Response(proc.stdout).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) return null

    // Parse "git version 2.39.0" -> "2.39.0"
    const match = output.match(/git version (\S+)/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

// ============================================================================
// Clone URL Generation
// ============================================================================

/**
 * Generate a clone URL from owner/repo format
 *
 * @param ownerRepo - Repository in owner/repo format
 * @param protocol - Clone protocol (ssh or https)
 * @returns Clone URL
 */
export function getCloneUrl(ownerRepo: string, protocol: CloneProtocol = "ssh"): string {
  if (protocol === "ssh") {
    return `git@github.com:${ownerRepo}.git`
  }
  return `https://github.com/${ownerRepo}.git`
}

/**
 * Parse owner/repo from a clone URL
 * Handles both SSH and HTTPS URLs
 */
export function parseOwnerRepo(url: string): string | null {
  // SSH format: git@github.com:owner/repo.git
  const sshMatch = url.match(/git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/)
  if (sshMatch?.[1]) {
    return sshMatch[1]
  }

  // HTTPS format: https://github.com/owner/repo.git
  const httpsMatch = url.match(/https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/)
  if (httpsMatch?.[1]) {
    return httpsMatch[1]
  }

  return null
}

/**
 * Validate owner/repo format
 */
export function isValidOwnerRepo(input: string): boolean {
  // Basic validation: owner/repo format
  // Owner and repo can contain alphanumeric, hyphens, underscores
  // Repo can also contain dots
  const pattern = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/
  return pattern.test(input)
}

// ============================================================================
// Clone Operations
// ============================================================================

/**
 * Clone a repository into the target directory
 *
 * Clones directly into the target directory (not a subdirectory).
 * Uses full history (no --depth 1) for proper worktree support.
 *
 * @param ownerRepo - Repository in owner/repo format
 * @param targetDir - Directory to clone into (must exist and be empty)
 * @param options - Clone options
 */
export async function cloneRepo(
  ownerRepo: string,
  targetDir: string,
  options: CloneOptions = {}
): Promise<CloneResult> {
  const { protocol = "ssh", onProgress } = options

  const cloneUrl = getCloneUrl(ownerRepo, protocol)

  onProgress?.(`Cloning ${ownerRepo} via ${protocol.toUpperCase()}...`)

  try {
    // Clone into current directory using "." as target
    // This requires the directory to be empty
    const proc = Bun.spawn(
      ["git", "clone", cloneUrl, "."],
      {
        cwd: targetDir,
        stdout: "pipe",
        stderr: "pipe",
      }
    )

    // Git outputs progress to stderr
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      // Parse common error messages
      if (stderr.includes("Repository not found")) {
        return {
          success: false,
          error: `Repository '${ownerRepo}' not found. Check the name and your access permissions.`,
        }
      }
      if (stderr.includes("Permission denied")) {
        return {
          success: false,
          error: `Permission denied. Check your SSH key or try HTTPS protocol.`,
        }
      }
      if (stderr.includes("Could not resolve host")) {
        return {
          success: false,
          error: `Could not connect to GitHub. Check your internet connection.`,
        }
      }
      if (stderr.includes("already exists and is not an empty directory")) {
        return {
          success: false,
          error: `Target directory is not empty. Choose an empty directory.`,
        }
      }
      if (stderr.includes("Authentication failed")) {
        return {
          success: false,
          error: `Authentication failed. Check your credentials or try SSH protocol.`,
        }
      }

      return {
        success: false,
        error: stderr.trim() || "Clone failed with unknown error",
      }
    }

    onProgress?.(`Successfully cloned ${ownerRepo}`)
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Clone failed",
    }
  }
}

/**
 * Check if a directory is empty (safe for cloning into)
 */
export async function isDirectoryEmptyForClone(path: string): Promise<boolean> {
  try {
    const { readdir } = await import("fs/promises")
    const entries = await readdir(path)
    // Allow .DS_Store and other hidden files that don't matter
    const significantEntries = entries.filter(
      (e) => !e.startsWith(".") || e === ".git"
    )
    return significantEntries.length === 0
  } catch {
    return false
  }
}

// ============================================================================
// Repository Checks
// ============================================================================

/**
 * Check if a directory is a git repository
 */
export async function isGitRepo(path: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(["git", "rev-parse", "--git-dir"], {
      cwd: path,
      stdout: "pipe",
      stderr: "pipe",
    })
    const exitCode = await proc.exited
    return exitCode === 0
  } catch {
    return false
  }
}

/**
 * Get the current branch name
 */
export async function getCurrentBranch(repoPath: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["git", "branch", "--show-current"], {
      cwd: repoPath,
      stdout: "pipe",
      stderr: "pipe",
    })
    const output = await new Response(proc.stdout).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) return null
    return output.trim() || null
  } catch {
    return null
  }
}

/**
 * Get the default branch name (main or master)
 */
export async function getDefaultBranch(repoPath: string): Promise<string | null> {
  try {
    // Try to get from remote
    const proc = Bun.spawn(
      ["git", "symbolic-ref", "refs/remotes/origin/HEAD", "--short"],
      {
        cwd: repoPath,
        stdout: "pipe",
        stderr: "pipe",
      }
    )
    const output = await new Response(proc.stdout).text()
    const exitCode = await proc.exited

    if (exitCode === 0 && output.trim()) {
      // Returns "origin/main" -> extract "main"
      const branch = output.trim().replace("origin/", "")
      return branch
    }

    // Fallback: check if main or master exists
    const mainProc = Bun.spawn(["git", "show-ref", "--verify", "--quiet", "refs/heads/main"], {
      cwd: repoPath,
      stdout: "pipe",
      stderr: "pipe",
    })
    if ((await mainProc.exited) === 0) return "main"

    const masterProc = Bun.spawn(["git", "show-ref", "--verify", "--quiet", "refs/heads/master"], {
      cwd: repoPath,
      stdout: "pipe",
      stderr: "pipe",
    })
    if ((await masterProc.exited) === 0) return "master"

    return null
  } catch {
    return null
  }
}

// ============================================================================
// Push Operations
// ============================================================================

/** Result of a push operation */
export interface PushBranchResult {
  success: boolean
  error?: string
}

/**
 * Push a branch to the remote origin
 *
 * @param repoPath - Path to the repository (can be a worktree)
 * @param branchName - Branch name to push
 * @param setUpstream - Whether to set upstream tracking (default: true)
 */
export async function pushBranch(
  repoPath: string,
  branchName: string,
  setUpstream: boolean = true
): Promise<PushBranchResult> {
  try {
    const args = ["git", "push"]
    if (setUpstream) {
      args.push("-u")
    }
    args.push("origin", branchName)

    const proc = Bun.spawn(args, {
      cwd: repoPath,
      stdout: "pipe",
      stderr: "pipe",
    })

    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      // Parse common error messages
      if (stderr.includes("Permission denied")) {
        return {
          success: false,
          error: "Permission denied. Check your SSH key or credentials.",
        }
      }
      if (stderr.includes("Could not resolve host")) {
        return {
          success: false,
          error: "Could not connect to GitHub. Check your internet connection.",
        }
      }
      if (stderr.includes("rejected")) {
        return {
          success: false,
          error: "Push rejected. The remote branch may have diverged.",
        }
      }
      if (stderr.includes("does not appear to be a git repository")) {
        return {
          success: false,
          error: "No remote 'origin' configured for this repository.",
        }
      }

      return {
        success: false,
        error: stderr.trim() || "Push failed with unknown error",
      }
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Push failed",
    }
  }
}

/**
 * Get the number of commits ahead of a base branch
 *
 * @param repoPath - Path to the repository (can be a worktree)
 * @param baseBranch - Base branch to compare against (default: "main")
 * @returns Number of commits ahead, or 0 if unable to determine
 */
export async function getCommitsAhead(
  repoPath: string,
  baseBranch: string = "main"
): Promise<number> {
  try {
    // First try with origin/<base> which is more reliable
    const proc = Bun.spawn(
      ["git", "rev-list", "--count", `origin/${baseBranch}..HEAD`],
      {
        cwd: repoPath,
        stdout: "pipe",
        stderr: "pipe",
      }
    )

    const output = await new Response(proc.stdout).text()
    const exitCode = await proc.exited

    if (exitCode === 0) {
      const count = parseInt(output.trim(), 10)
      return isNaN(count) ? 0 : count
    }

    // Fallback to local branch comparison
    const localProc = Bun.spawn(
      ["git", "rev-list", "--count", `${baseBranch}..HEAD`],
      {
        cwd: repoPath,
        stdout: "pipe",
        stderr: "pipe",
      }
    )

    const localOutput = await new Response(localProc.stdout).text()
    const localExitCode = await localProc.exited

    if (localExitCode === 0) {
      const count = parseInt(localOutput.trim(), 10)
      return isNaN(count) ? 0 : count
    }

    return 0
  } catch {
    return 0
  }
}
