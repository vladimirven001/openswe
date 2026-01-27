/**
 * Provider registry for AI backend lookup
 *
 * Centralized access to all registered providers.
 */

import type { AIBackend } from "../config/types"
import type { Provider } from "./types"
import { openCodeProvider } from "./opencode"
import { claudeProvider } from "./claude"

// ============================================================================
// Registry
// ============================================================================

const providers: Map<AIBackend, Provider> = new Map([
	["opencode", openCodeProvider],
	["claude", claudeProvider],
])

// ============================================================================
// Public API
// ============================================================================

/**
 * Get a provider by its backend ID
 * @param backend - The backend identifier (e.g., "opencode", "claude")
 * @returns The provider instance
 * @throws Error if provider not found
 */
export function getProvider(backend: AIBackend): Provider {
	const provider = providers.get(backend)
	if (!provider) {
		throw new Error(`Unknown AI backend: ${backend}. Available: ${Array.from(providers.keys()).join(", ")}`)
	}
	return provider
}

/**
 * Get all registered providers
 * @returns Array of all provider instances
 */
export function getAllProviders(): Provider[] {
	return Array.from(providers.values())
}

/**
 * Check if a backend is supported
 * @param backend - The backend identifier to check
 */
export function isProviderSupported(backend: string): backend is AIBackend {
	return providers.has(backend as AIBackend)
}
