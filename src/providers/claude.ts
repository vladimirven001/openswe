/**
 * Claude Code provider implementation
 *
 * Supports the Claude CLI (https://docs.anthropic.com/claude-code)
 */

import type { Provider, ProviderBranding, ProviderInputCapabilities, ParserPatterns, SpawnCommand, SpawnCommandOptions } from "./types"
import type { Session } from "../store"

// ============================================================================
// Branding
// ============================================================================

const branding: ProviderBranding = {
	displayName: "Claude Code",
	shortName: "claude",
	accentColor: "#cc785c",
	secondaryColor: "#a65f48",
	logoText: "CC",
	installationUrl: "https://docs.anthropic.com/claude-code",
}

const inputCapabilities: ProviderInputCapabilities = {
	submitKeys: ["Enter"],
	newlineKeys: ["\\ + Enter"],
	tmuxNotes: [
		"Modified Enter behavior depends on terminal configuration.",
	],
}

// ============================================================================
// Parser Patterns
// ============================================================================

const parserPatterns: ParserPatterns = {
	// Claude Code outputs status messages differently
	workingRegex: /(?:starting|begin|entering).+(?:implementation|coding|execution)|(?:mode|status):\s*(?:implement|coding)|editing|writing.*file/i,
	doneRegex: /\[?OPENSWE:DONE\]?|completed successfully|task completed/i,
	sessionIdRegex: /(?:Session ID|session id):\s*([a-zA-Z0-9_-]+)/i,
}

// ============================================================================
// Provider Implementation
// ============================================================================

export const claudeProvider: Provider = {
	id: "claude",
	name: "Claude Code",
	branding,
	inputCapabilities,
	parserPatterns,

	isValidSessionId(sessionId: string): boolean {
		return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)
	},

	getResumeSessionId(session: Session, explicitResumeSessionId?: string): string | undefined {
		if (explicitResumeSessionId && this.isValidSessionId(explicitResumeSessionId)) {
			return explicitResumeSessionId
		}

		const stored = session.aiSessionData?.sessionId
		if (stored && this.isValidSessionId(stored)) {
			return stored
		}

		return undefined
	},

	buildSpawnCommand(
		_session: Session,
		prompt?: string,
		resumeSessionId?: string,
		_options?: SpawnCommandOptions
	): SpawnCommand {
		// Run Claude Code interactively (no --print flag)
		// User can attach to the tmux session to review and approve changes
		const args: string[] = []

		if (resumeSessionId) {
			args.push("--resume", resumeSessionId)
		}

		// Add the prompt as the final argument (omit for interactive mode)
		if (prompt) {
			args.push(prompt)
		}

		return {
			command: "claude",
			args,
		}
	},

	async validateInstallation(): Promise<boolean> {
		try {
			const proc = Bun.spawn(["claude", "--version"], {
				stdout: "pipe",
				stderr: "pipe",
			})
			const exitCode = await proc.exited
			return exitCode === 0
		} catch {
			return false
		}
	},

	async getVersion(): Promise<string | null> {
		try {
			const proc = Bun.spawn(["claude", "--version"], {
				stdout: "pipe",
				stderr: "pipe",
			})
			const exitCode = await proc.exited
			if (exitCode !== 0) return null

			const output = await new Response(proc.stdout).text()
			// Extract version from output
			const match = output.match(/v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/)
			return match ? match[1] ?? null : output.trim() || null
		} catch {
			return null
		}
	},
}
