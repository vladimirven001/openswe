/**
 * Pull Request creation via gh CLI
 *
 * Provides functions for creating GitHub PRs with template support.
 */

// ============================================================================
// Types
// ============================================================================

/** Options for creating a pull request */
export interface CreatePROptions {
  /** Path to the repository (can be a worktree) */
  repoPath: string
  /** Branch name to create PR from */
  branchName: string
  /** Base branch to merge into (default: detected from repo) */
  baseBranch?: string
  /** Issue number (for template replacement) */
  issueNumber: number | null
  /** Issue title (for template replacement) */
  issueTitle: string | null
  /** AI-generated summary (for template replacement) */
  aiSummary?: string
  /** Whether to create as draft */
  draft: boolean
  /** Template for PR title */
  titleTemplate: string
  /** Template for PR body */
  bodyTemplate: string
}

/** Result of creating a pull request */
export interface CreatePRResult {
  /** Whether the creation succeeded */
  success: boolean
  /** URL of the created PR */
  prUrl?: string
  /** Error message if creation failed */
  error?: string
}

// ============================================================================
// Template Processing
// ============================================================================

/**
 * Replace template placeholders with actual values
 */
function processTemplate(
  template: string,
  values: {
    issueNumber: number | null
    issueTitle: string | null
    aiSummary: string
  }
): string {
  return template
    .replace(/\{\{issue_number\}\}/g, values.issueNumber?.toString() ?? "")
    .replace(/\{\{issue_title\}\}/g, values.issueTitle ?? "")
    .replace(/\{\{ai_summary\}\}/g, values.aiSummary)
}

// ============================================================================
// PR Creation
// ============================================================================

/**
 * Create a pull request using gh CLI
 *
 * @param options - PR creation options including templates
 * @returns Result with PR URL or error
 */
export async function createPR(options: CreatePROptions): Promise<CreatePRResult> {
  const {
    repoPath,
    branchName,
    baseBranch,
    issueNumber,
    issueTitle,
    aiSummary = "No summary available.",
    draft,
    titleTemplate,
    bodyTemplate,
  } = options

  // Process templates
  const templateValues = { issueNumber, issueTitle, aiSummary }
  const title = processTemplate(titleTemplate, templateValues)
  const body = processTemplate(bodyTemplate, templateValues)

  // Build command arguments
  const args = [
    "gh",
    "pr",
    "create",
    "--title",
    title,
    "--body",
    body,
    "--head",
    branchName,
  ]

  if (baseBranch) {
    args.push("--base", baseBranch)
  }

  if (draft) {
    args.push("--draft")
  }

  try {
    const proc = Bun.spawn(args, {
      cwd: repoPath,
      stdout: "pipe",
      stderr: "pipe",
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      return {
        success: false,
        error: parseGhPRError(stderr),
      }
    }

    // The PR URL is printed to stdout
    const prUrl = stdout.trim()

    if (!prUrl || !prUrl.startsWith("http")) {
      return {
        success: false,
        error: "Failed to get PR URL from gh output",
      }
    }

    return {
      success: true,
      prUrl,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create PR",
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse gh CLI error messages into user-friendly strings
 */
function parseGhPRError(stderr: string): string {
  const trimmed = stderr.trim()

  if (trimmed.includes("not logged in")) {
    return "Not authenticated with GitHub. Run: gh auth login"
  }
  if (trimmed.includes("already exists")) {
    return "A pull request already exists for this branch."
  }
  if (trimmed.includes("No commits between")) {
    return "No commits to create a PR. The branch is up to date with base."
  }
  if (trimmed.includes("could not find branch")) {
    return "Branch not found on remote. Push the branch first."
  }
  if (trimmed.includes("permission denied") || trimmed.includes("HTTP 403")) {
    return "Permission denied. You may not have write access to this repository."
  }
  if (trimmed.includes("HTTP 404")) {
    return "Repository not found or you don't have access."
  }
  if (trimmed.includes("HTTP 422")) {
    // Usually validation errors
    if (trimmed.includes("already exists")) {
      return "A pull request already exists for this branch."
    }
    return "GitHub rejected the PR. Check if a PR already exists for this branch."
  }

  return trimmed || "Failed to create pull request"
}

/**
 * Check if a PR already exists for a branch
 *
 * @param repoPath - Path to the repository
 * @param branchName - Branch name to check
 * @returns PR URL if exists, null otherwise
 */
export async function getExistingPR(
  repoPath: string,
  branchName: string
): Promise<string | null> {
  try {
    const proc = Bun.spawn(
      ["gh", "pr", "view", branchName, "--json", "url", "--jq", ".url"],
      {
        cwd: repoPath,
        stdout: "pipe",
        stderr: "pipe",
      }
    )

    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited

    if (exitCode === 0 && stdout.trim()) {
      return stdout.trim()
    }

    return null
  } catch {
    return null
  }
}
