/**
 * Ticket provider system exports
 */

export { githubTicketProvider } from "./github"
export { jiraTicketProvider } from "./jira"

export { getTicketProvider, getAllTicketProviders, isTicketProviderSupported } from "./registry"

export type { TicketProvider } from "./types"

export type {
  TicketProviderType,
  TicketState,
  TicketLabel,
  Ticket,
  FetchTicketsOptions,
  FetchTicketsResult,
  FetchTicketResult,
  TicketProviderConfig,
  GitHubTicketProviderConfig,
  JIRATicketProviderConfig,
  TicketProviderConfigUnion,
  TicketProviderValidationResult,
} from "./types"