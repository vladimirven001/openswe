/**
 * Ticket provider registry
 *
 * Centralized access to all registered ticket providers.
 */

import type { TicketProviderType } from "../store/types"
import type { TicketProvider } from "./types"
import { githubTicketProvider } from "./github"
import { jiraTicketProvider } from "./jira"

const providers: Map<TicketProviderType, TicketProvider> = new Map([
  ["github", githubTicketProvider],
  ["jira", jiraTicketProvider],
])

export function getTicketProvider(type: TicketProviderType): TicketProvider {
  const provider = providers.get(type)
  if (!provider) {
    throw new Error(
      `Unknown ticket provider: ${type}. Available: ${Array.from(providers.keys()).join(", ")}`
    )
  }
  return provider
}

export function getAllTicketProviders(): TicketProvider[] {
  return Array.from(providers.values())
}

export function isTicketProviderSupported(type: string): type is TicketProviderType {
  return providers.has(type as TicketProviderType)
}
