/**
 * Claude Code provider implementation
 *
 * Supports the Claude CLI (https://docs.anthropic.com/claude-code)
 */

import type { Provider, ProviderBranding, ParserPatterns, SpawnCommand } from "./types"
import type { Session } from "../store"
import type { ClaudeConfig } from "../config/types"

// ============================================================================
// Branding
// ============================================================================

const branding: ProviderBranding = {
	displayName: "Claude Code",
	shortName: "claude",
	accentColor: "#cc785c",
	secondaryColor: "#a65f48",
	logoText: "CC",
}

// ============================================================================
// Parser Patterns
// ============================================================================

const parserPatterns: ParserPatterns = {
	// Claude Code outputs status messages differently
	workingRegex: /(?:starting|begin|entering).+(?:implementation|coding|execution)|(?:mode|status):\s*(?:implement|coding)|editing|writing.*file/i,
	doneRegex: /\[?OPENSWE:DONE\]?|completed successfully|task completed/i,
	sessionIdRegex: /(?:Session ID|session id):\s*([a-zA-Z0-9-]+)/i,
}

// ============================================================================
// Provider Implementation
// ============================================================================

export const claudeProvider: Provider = {
	id: "claude",
	name: "Claude Code",
	branding,
	parserPatterns,

	buildSpawnCommand(
		session: Session,
		prompt?: string,
		resumeSessionId?: string,
		config?: Record<string, unknown>
	): SpawnCommand {
		const claudeConfig = config as ClaudeConfig | undefined
		const model = claudeConfig?.model ?? "claude-sonnet-4-20250514"

		// Run Claude Code interactively (no --print flag)
		// User can attach to the tmux session to review and approve changes
		const args = [
			"--model", model,
		]

		if (resumeSessionId) {
			args.push("--resume", resumeSessionId)
		} else if (session.aiSessionData?.sessionId) {
			args.push("--session-id", session.aiSessionData.sessionId)
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
			const proc = Bun.spawn(["which", "claude"], {
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
