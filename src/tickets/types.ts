/**
 * Ticket provider type definitions
 *
 * Provides abstraction for multiple ticket/issue providers
 * (GitHub Issues, JIRA, etc.)
 */

import type { TicketProviderType } from "../store/types"

export type { TicketProviderType }

export type TicketState = "open" | "closed"

export interface TicketLabel {
  name: string
  color: string
}

export interface Ticket {
  id: string
  number: number
  title: string
  body: string | null
  state: TicketState
  url: string
  labels: TicketLabel[]
  createdAt: string
  updatedAt: string
}

export interface FetchTicketsOptions {
  state?: TicketState | "all"
  labels?: string[]
  limit?: number
}

export interface FetchTicketsResult {
  success: boolean
  tickets: Ticket[]
  error?: string
}

export interface FetchTicketResult {
  success: boolean
  ticket: Ticket | null
  error?: string
}

export interface TicketProviderConfig {
  type: TicketProviderType
}

export interface GitHubTicketProviderConfig extends TicketProviderConfig {
  type: "github"
}

export interface JIRATicketProviderConfig extends TicketProviderConfig {
  type: "jira"
  jiraHost: string
  jiraProjectKey: string
  jiraEmail?: string
}

export type TicketProviderConfigUnion = GitHubTicketProviderConfig | JIRATicketProviderConfig

export interface TicketProviderValidationResult {
  valid: boolean
  error?: string
}

export interface TicketProvider {
  readonly id: TicketProviderType
  readonly name: string

  fetchTickets(
    repoFullName: string,
    options?: FetchTicketsOptions
  ): Promise<FetchTicketsResult>

  getTicket(
    repoFullName: string,
    ticketId: string
  ): Promise<FetchTicketResult>

  validateConfig(config: TicketProviderConfig): Promise<TicketProviderValidationResult>
}
