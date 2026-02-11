/**
 * Provider type definitions for AI backend abstraction
 *
 * Supports multiple AI backends (Claude Code, OpenCode, etc.)
 * with provider-specific command building and branding.
 */

import type { AIBackend } from "../config/types"
import type { Session } from "../store"

// ============================================================================
// Core Provider Interface
// ============================================================================

/**
 * Abstract provider interface for AI backends
 *
 * Implementations handle:
 * - Command building for spawning AI sessions
 * - Branding for UI display
 * - Parser patterns for output detection
 * - Installation/version validation
 */
export interface Provider {
	/** Unique identifier matching AIBackend type */
	readonly id: AIBackend
	/** Human-readable display name */
	readonly name: string
	/** UI branding configuration */
	readonly branding: ProviderBranding
	/** Output parser patterns */
	readonly parserPatterns: ParserPatterns

	/**
	 * Build the spawn command for starting an AI session
	 * @param session - Session to start
	 * @param prompt - Optional prompt to send to the AI (omit for interactive mode)
	 * @param resumeSessionId - Optional session ID to resume
	 * @param config - Provider-specific configuration
	 */
	buildSpawnCommand(
		session: Session,
		prompt?: string,
		resumeSessionId?: string,
		options?: SpawnCommandOptions
	): SpawnCommand

	/**
	 * Validate that the provider CLI is installed
	 * @returns true if installed and accessible
	 */
	validateInstallation(): Promise<boolean>

	/**
	 * Get the installed version of the provider CLI
	 * @returns Version string or null if not installed
	 */
	getVersion(): Promise<string | null>
}

// ============================================================================
// Spawn Options
// ============================================================================

export interface SpawnCommandOptions {
	sessionTitle?: string
}

// ============================================================================
// Branding Configuration
// ============================================================================

/**
 * UI branding configuration for providers
 *
 * Used for consistent styling in Preview, StatusBar, and other components.
 */
export interface ProviderBranding {
	/** Full display name (e.g., "Claude Code") */
	displayName: string
	/** Short name for compact displays (e.g., "claude") */
	shortName: string
	/** Primary accent color (hex) for borders and highlights */
	accentColor: string
	/** Secondary color (hex) for backgrounds and subtle elements */
	secondaryColor: string
	/** Optional custom header background color */
	headerBackground?: string
	/** Optional logo text for header display */
	logoText?: string
	/** Optional terminal output background color (undefined = transparent) */
	terminalBackground?: string
}

// ============================================================================
// Parser Patterns
// ============================================================================

/**
 * Regex patterns for parsing AI output
 *
 * Each provider may have different markers for phase transitions.
 */
export interface ParserPatterns {
	/** Pattern to detect working/implementation phase */
	workingRegex: RegExp
	/** Pattern to detect completion */
	doneRegex: RegExp
	/** Pattern to detect session ID */
	sessionIdRegex?: RegExp
}

// ============================================================================
// Spawn Command
// ============================================================================

/**
 * Command specification for spawning an AI session
 */
export interface SpawnCommand {
	/** CLI command to execute (e.g., "opencode", "claude") */
	command: string
	/** Arguments to pass to the command */
	args: string[]
	/** Optional environment variables to set */
	env?: Record<string, string>
}
