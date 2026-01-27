/**
 * Provider system exports
 *
 * Abstract AI backend provider interface with implementations
 * for OpenCode and Claude Code.
 */

// Registry functions
export { getProvider, getAllProviders, isProviderSupported } from "./registry"

// Provider implementations
export { openCodeProvider } from "./opencode"
export { claudeProvider } from "./claude"

// Types
export type {
	Provider,
	ProviderBranding,
	ParserPatterns,
	SpawnCommand,
} from "./types"
