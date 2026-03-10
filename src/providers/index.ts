/**
 * Provider system exports
 *
 * Abstract AI backend provider interface with implementations
 * for OpenCode, Claude Code, and OpenAI Codex.
 */

// Registry functions
export { getProvider, getAllProviders, isProviderSupported } from "./registry"

// Provider implementations
export { openCodeProvider } from "./opencode"
export { claudeProvider } from "./claude"
export { codexProvider } from "./codex"

// Types
export type {
	Provider,
	ProviderBranding,
	ProviderInputCapabilities,
	ParserPatterns,
	SpawnCommand,
	ProviderSessionRef,
	ProviderSessionCaptureInput,
} from "./types"
