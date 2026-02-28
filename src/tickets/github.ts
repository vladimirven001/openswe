/**
 * GitHub ticket provider implementation
 *
 * Provides ticket fetching via GitHub Issues using the gh CLI.
 */

import { fetchIssues, getIssue, type GitHubIssue } from "../github/issues"
import type {
  TicketProvider,
  TicketProviderConfig,
  TicketProviderValidationResult,
  FetchTicketsOptions,
  FetchTicketsResult,
  FetchTicketResult,
  Ticket,
} from "./types"

const DEFAULT_TIMEOUT_MS = 30000

function convertGitHubIssue(issue: GitHubIssue, repoFullName: string): Ticket {
  return {
    id: String(issue.number),
    number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state === "OPEN" ? "open" : "closed",
    url: issue.url,
    labels: issue.labels.map((l) => ({ name: l.name, color: l.color })),
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  }
}

export const githubTicketProvider: TicketProvider = {
  id: "github",

  name: "GitHub Issues",

  async fetchTickets(
    repoFullName: string,
    options?: FetchTicketsOptions
  ): Promise<FetchTicketsResult> {
    const result = await fetchIssues(repoFullName, {
      state: options?.state ?? "open",
      labels: options?.labels,
      limit: options?.limit ?? 50,
    })

    if (!result.success) {
      return {
        success: false,
        tickets: [],
        error: result.error,
      }
    }

    const tickets = result.issues.map((issue) => convertGitHubIssue(issue, repoFullName))

    return {
      success: true,
      tickets,
    }
  },

  async getTicket(
    repoFullName: string,
    ticketId: string
  ): Promise<FetchTicketResult> {
    const issueNumber = parseInt(ticketId, 10)
    if (isNaN(issueNumber)) {
      return {
        success: false,
        ticket: null,
        error: "Invalid ticket ID. Expected a numeric issue number.",
      }
    }

    const result = await getIssue(repoFullName, issueNumber)

    if (!result.success || !result.issue) {
      return {
        success: false,
        ticket: null,
        error: result.error ?? "Issue not found",
      }
    }

    return {
      success: true,
      ticket: convertGitHubIssue(result.issue, repoFullName),
    }
  },

  async validateConfig(config: TicketProviderConfig): Promise<TicketProviderValidationResult> {
    if (config.type !== "github") {
      return {
        valid: false,
        error: "Invalid config type for GitHub provider",
      }
    }

    return { valid: true }
  },
}
