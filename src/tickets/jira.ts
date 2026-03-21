/**
 * JIRA ticket provider implementation (stub)
 *
 * Provides a stub implementation for JIRA integration.
 * Currently returns empty results - full implementation pending.
 */

import type {
  TicketProvider,
  TicketProviderConfig,
  TicketProviderValidationResult,
  FetchTicketsOptions,
  FetchTicketsResult,
  FetchTicketResult,
  Ticket,
} from "./types"

export const jiraTicketProvider: TicketProvider = {
  id: "jira",

  name: "JIRA",

  async fetchTickets(
    _repoFullName: string,
    _options?: FetchTicketsOptions
  ): Promise<FetchTicketsResult> {
    return {
      success: false,
      tickets: [],
      error: "JIRA provider not implemented",
    }
  },

  async getTicket(
    _repoFullName: string,
    _ticketId: string
  ): Promise<FetchTicketResult> {
    return {
      success: false,
      ticket: null,
      error: "JIRA provider not yet implemented",
    }
  },

  async validateConfig(config: TicketProviderConfig): Promise<TicketProviderValidationResult> {
    if (config.type !== "jira") {
      return {
        valid: false,
        error: "Invalid config type for JIRA provider",
      }
    }

    const jiraConfig = config as { jiraHost?: string; jiraProjectKey?: string }

    if (!jiraConfig.jiraHost) {
      return {
        valid: false,
        error: "JIRA host is required",
      }
    }

    if (!jiraConfig.jiraProjectKey) {
      return {
        valid: false,
        error: "JIRA project key is required",
      }
    }

    return { valid: true }
  },
}
