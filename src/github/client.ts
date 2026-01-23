/**
 * GitHub CLI (gh) wrapper
 *
 * Provides validation and authentication checking via the gh CLI.
 */

// ============================================================================
// Types
// ============================================================================

/** Result of checking gh CLI installation and authentication */
export interface GhCheckResult {
  /** Whether gh CLI is installed */
  installed: boolean
  /** Whether user is authenticated */
  authenticated: boolean
  /** Error message if check failed */
  error?: string
}

/** Result of validating a GitHub repository */
export interface RepoValidation {
  /** Whether the repository exists */
  exists: boolean
  /** Whether the repository is accessible to the user */
  accessible: boolean
  /** Default branch name (e.g., "main") */
  defaultBranch?: string
  /** Whether the repository is private */
  isPrivate?: boolean
  /** Error message if validation failed */
  error?: string
}

// ============================================================================
// gh CLI Check
// ============================================================================

/**
 * Check if gh CLI is installed and authenticated
 */
export async function checkGhCli(): Promise<GhCheckResult> {
  // First, check if gh is installed
  try {
    const versionProc = Bun.spawn(["gh", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const versionExit = await versionProc.exited

    if (versionExit !== 0) {
      return {
        installed: false,
        authenticated: false,
        error: "GitHub CLI (gh) is not installed. Install it from https://cli.github.com/",
      }
    }
  } catch {
    return {
      installed: false,
      authenticated: false,
      error: "GitHub CLI (gh) is not installed. Install it from https://cli.github.com/",
    }
  }

  // Check authentication status
  try {
    const authProc = Bun.spawn(["gh", "auth", "status"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const stderr = await new Response(authProc.stderr).text()
    const authExit = await authProc.exited

    if (authExit !== 0) {
      // Check for specific error messages
      if (stderr.includes("not logged in")) {
        return {
          installed: true,
          authenticated: false,
          error: "Not authenticated with GitHub. Run: gh auth login",
        }
      }
      return {
        installed: true,
        authenticated: false,
        error: stderr.trim() || "Not authenticated with GitHub. Run: gh auth login",
      }
    }

    return {
      installed: true,
      authenticated: true,
    }
  } catch (err) {
    return {
      installed: true,
      authenticated: false,
      error: err instanceof Error ? err.message : "Failed to check authentication status",
    }
  }
}

// ============================================================================
// Repository Validation
// ============================================================================

/**
 * Validate that a GitHub repository exists and is accessible
 *
 * @param ownerRepo - Repository in "owner/repo" format
 */
export async function validateGhRepo(ownerRepo: string): Promise<RepoValidation> {
  try {
    const proc = Bun.spawn(
      ["gh", "repo", "view", ownerRepo, "--json", "name,defaultBranchRef,isPrivate"],
      {
        stdout: "pipe",
        stderr: "pipe",
      }
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      // Parse common error messages
      if (stderr.includes("Could not resolve to a Repository")) {
        return {
          exists: false,
          accessible: false,
          error: `Repository '${ownerRepo}' not found. Check the name and try again.`,
        }
      }
      if (stderr.includes("HTTP 404")) {
        return {
          exists: false,
          accessible: false,
          error: `Repository '${ownerRepo}' not found or you don't have access.`,
        }
      }
      if (stderr.includes("HTTP 403") || stderr.includes("must have push access")) {
        return {
          exists: true,
          accessible: false,
          error: `You don't have access to '${ownerRepo}'. Check your permissions.`,
        }
      }
      if (stderr.includes("not logged in")) {
        return {
          exists: false,
          accessible: false,
          error: "Not authenticated with GitHub. Run: gh auth login",
        }
      }

      return {
        exists: false,
        accessible: false,
        error: stderr.trim() || "Failed to validate repository",
      }
    }

    // Parse JSON response
    try {
      const data = JSON.parse(stdout) as {
        name?: string
        defaultBranchRef?: { name?: string }
        isPrivate?: boolean
      }

      return {
        exists: true,
        accessible: true,
        defaultBranch: data.defaultBranchRef?.name,
        isPrivate: data.isPrivate,
      }
    } catch {
      // JSON parse failed but command succeeded - repo exists
      return {
        exists: true,
        accessible: true,
      }
    }
  } catch (err) {
    return {
      exists: false,
      accessible: false,
      error: err instanceof Error ? err.message : "Failed to validate repository",
    }
  }
}

/**
 * Check if gh CLI is available (quick check, no auth validation)
 */
export async function isGhInstalled(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["gh", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    return (await proc.exited) === 0
  } catch {
    return false
  }
}
