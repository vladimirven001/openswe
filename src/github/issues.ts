/**
 * GitHub issue fetching via gh CLI
 *
 * Provides functions for fetching and viewing GitHub issues.
 */

// ============================================================================
// Types
// ============================================================================

/** Issue state filter */
export type IssueState = "open" | "closed" | "all"

/** Issue label information */
export interface IssueLabel {
  /** Label name */
  name: string
  /** Label color (hex without #) */
  color: string
}

/** GitHub issue data */
export interface GitHubIssueComment {
  /** Comment author login if available */
  author: string | null
  /** Comment body */
  body: string
  /** ISO timestamp when comment was created */
  createdAt: string
  /** Comment URL on GitHub */
  url: string
}

/** GitHub issue data */
export interface GitHubIssue {
  /** Issue number */
  number: number
  /** Issue title */
  title: string
  /** Issue body/description (may be null) */
  body: string | null
  /** Issue state */
  state: "OPEN" | "CLOSED"
  /** Issue URL on GitHub */
  url: string
  /** Labels attached to the issue */
  labels: IssueLabel[]
  /** ISO timestamp when issue was created */
  createdAt: string
  /** ISO timestamp when issue was last updated */
  updatedAt: string
  /** Issue comments */
  comments: GitHubIssueComment[]
}

/** Options for fetching issues */
export interface FetchIssuesOptions {
  /** Filter by state (default: "open") */
  state?: IssueState
  /** Filter by labels (AND logic) */
  labels?: string[]
  /** Maximum number of issues to fetch (default: 50) */
  limit?: number
}

/** Result of fetching issues */
export interface FetchIssuesResult {
  /** Whether the fetch succeeded */
  success: boolean
  /** Fetched issues */
  issues: GitHubIssue[]
  /** Error message if fetch failed */
  error?: string
}

/** Result of fetching a single issue */
export interface FetchIssueResult {
  /** Whether the fetch succeeded */
  success: boolean
  /** The fetched issue (null if not found) */
  issue: GitHubIssue | null
  /** Error message if fetch failed */
  error?: string
}

interface RawGitHubComment {
  author?: {
    login?: string | null
  } | null
  body?: string | null
  createdAt?: string | null
  url?: string | null
}

interface RawGitHubIssue {
  number: number
  title: string
  body: string | null
  state: string
  url: string
  labels: Array<{ name: string; color: string }>
  createdAt: string
  updatedAt: string
  comments?: RawGitHubComment[]
}

// ============================================================================
// Constants
// ============================================================================

/** Default timeout for GitHub API operations in milliseconds */
const DEFAULT_TIMEOUT_MS = 30000

// ============================================================================
// Issue Fetching
// ============================================================================

/**
 * Fetch issues from a GitHub repository
 *
 * @param ownerRepo - Repository in "owner/repo" format
 * @param options - Fetch options (state, labels, limit)
 * @returns Result with fetched issues or error
 */
export async function fetchIssues(
  ownerRepo: string,
  options?: FetchIssuesOptions
): Promise<FetchIssuesResult> {
  const { state = "open", labels = [], limit = 50 } = options ?? {}

  try {
    // Build command arguments
    const args = [
      "gh",
      "issue",
      "list",
      "--repo",
      ownerRepo,
      "--state",
      state,
      "--limit",
      String(limit),
      "--json",
      "number,title,body,state,url,labels,createdAt,updatedAt,comments",
    ]

    // Add label filters
    for (const label of labels) {
      args.push("--label", label)
    }

    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
    })

    // Race between process completion and timeout
    const timeoutPromise = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), DEFAULT_TIMEOUT_MS)
    )

    const raceResult = await Promise.race([proc.exited, timeoutPromise])

    if (raceResult === "timeout") {
      // Kill the process if it's still running
      try {
        proc.kill()
      } catch {
        // Ignore kill errors
      }
      return {
        success: false,
        issues: [],
        error: "Request timed out. Check your internet connection.",
      }
    }

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = raceResult

    if (exitCode !== 0) {
      return {
        success: false,
        issues: [],
        error: parseGhError(stderr),
      }
    }

    // Parse JSON response
    try {
      const rawIssues = JSON.parse(stdout) as RawGitHubIssue[]

      const issues: GitHubIssue[] = rawIssues.map(mapRawIssue)

      return {
        success: true,
        issues,
      }
    } catch {
      return {
        success: false,
        issues: [],
        error: "Failed to parse GitHub response",
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return {
      success: false,
      issues: [],
      error: `Failed to fetch issues: ${message}`,
    }
  }
}

/**
 * Fetch a single issue by number
 *
 * @param ownerRepo - Repository in "owner/repo" format
 * @param issueNumber - Issue number
 * @returns Result with the issue or error
 */
export async function getIssue(
  ownerRepo: string,
  issueNumber: number
): Promise<FetchIssueResult> {
  try {
    const proc = Bun.spawn(
      [
        "gh",
        "issue",
        "view",
        String(issueNumber),
        "--repo",
        ownerRepo,
        "--json",
        "number,title,body,state,url,labels,createdAt,updatedAt,comments",
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      }
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      return {
        success: false,
        issue: null,
        error: parseGhError(stderr),
      }
    }

    // Parse JSON response
    try {
      const raw = JSON.parse(stdout) as RawGitHubIssue

      const issue = mapRawIssue(raw)

      return {
        success: true,
        issue,
      }
    } catch {
      return {
        success: false,
        issue: null,
        error: "Failed to parse GitHub response",
      }
    }
  } catch (err) {
    return {
      success: false,
      issue: null,
      error: err instanceof Error ? err.message : "Failed to fetch issue",
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function mapRawComment(raw: RawGitHubComment): GitHubIssueComment {
  return {
    author: raw.author?.login ?? null,
    body: raw.body ?? "",
    createdAt: raw.createdAt ?? "",
    url: raw.url ?? "",
  }
}

function mapRawIssue(raw: RawGitHubIssue): GitHubIssue {
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body,
    state: normalizeIssueState(raw.state),
    url: raw.url,
    labels: raw.labels.map((l) => ({ name: l.name, color: l.color })),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    comments: (raw.comments ?? []).map(mapRawComment),
  }
}

function normalizeIssueState(state: string): "OPEN" | "CLOSED" {
  const normalized = state.trim().toUpperCase()

  if (normalized === "OPEN") return "OPEN"
  if (normalized === "CLOSED") return "CLOSED"

  console.warn(`Unexpected GitHub issue state: ${state}. Falling back to OPEN.`)

  return "OPEN"
}

/**
 * Parse gh CLI error messages into user-friendly strings
 */
function parseGhError(stderr: string): string {
  const trimmed = stderr.trim()

  if (trimmed.includes("not logged in")) {
    return "Not authenticated with GitHub. Run: gh auth login"
  }
  if (trimmed.includes("Could not resolve to a Repository")) {
    return "Repository not found. Check the repository name."
  }
  if (trimmed.includes("HTTP 404")) {
    return "Repository not found or you don't have access."
  }
  if (trimmed.includes("HTTP 403")) {
    return "Access denied. Check your permissions."
  }
  if (trimmed.includes("no issues match")) {
    return "No issues found matching the criteria."
  }
  if (trimmed.includes("could not find issue")) {
    return "Issue not found."
  }

  return trimmed || "Failed to fetch from GitHub"
}

/**
 * Format relative time from an ISO timestamp
 *
 * @param isoString - ISO timestamp string
 * @returns Human-readable relative time (e.g., "3 days ago")
 */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)

  if (months > 0) {
    return months === 1 ? "1 month ago" : `${months} months ago`
  }
  if (weeks > 0) {
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`
  }
  if (days > 0) {
    return days === 1 ? "1 day ago" : `${days} days ago`
  }
  if (hours > 0) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`
  }
  if (minutes > 0) {
    return minutes === 1 ? "1 min ago" : `${minutes} mins ago`
  }
  return "just now"
}
