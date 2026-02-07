/**
 * OpenAI Codex provider implementation
 *
 * Supports the Codex CLI (https://github.com/openai/codex)
 */

import type { Provider, ProviderBranding, ParserPatterns, SpawnCommand } from "./types"
import type { Session } from "../store"
import type { CodexConfig } from "../config/types"

// ============================================================================
// Branding
// ============================================================================

const branding: ProviderBranding = {
	displayName: "Codex",
	shortName: "codex",
	accentColor: "#10a37f",
	secondaryColor: "#0d8c6d",
	logoText: "CX",
}

// ============================================================================
// Parser Patterns
// ============================================================================

const parserPatterns: ParserPatterns = {
	workingRegex: /(?:starting|begin|entering).+(?:implementation|coding|execution)|(?:mode|status):\s*(?:implement|coding)|editing|writing.*file/i,
	doneRegex: /\[?OPENSWE:DONE\]?|completed successfully|task completed/i,
}

// ============================================================================
// Provider Implementation
// ============================================================================

export const codexProvider: Provider = {
	id: "codex",
	name: "Codex",
	branding,
	parserPatterns,

	buildSpawnCommand(
		_session: Session,
		prompt?: string,
		resumeSessionId?: string,
		config?: Record<string, unknown>
	): SpawnCommand {
		const codexConfig = config as CodexConfig | undefined
		const model = codexConfig?.model ?? "o3"

		// Resume a previous session via the `codex resume` subcommand
		if (resumeSessionId) {
			const args = ["resume", resumeSessionId, "--model", model]
			if (prompt) {
				args.push(prompt)
			}
			return { command: "codex", args }
		}

		// Start a new interactive session
		// No --full-auto: user can attach to tmux to review and approve actions
		const args = ["--model", model]

		if (prompt) {
			args.push(prompt)
		}

		return {
			command: "codex",
			args,
		}
	},

	async validateInstallation(): Promise<boolean> {
		try {
			const proc = Bun.spawn(["which", "codex"], {
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
			const proc = Bun.spawn(["codex", "--version"], {
				stdout: "pipe",
				stderr: "pipe",
			})
			const exitCode = await proc.exited
			if (exitCode !== 0) return null

			const output = await new Response(proc.stdout).text()
			// Codex outputs "codex-cli X.Y.Z"
			const match = output.match(/v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/)
			return match ? match[1] ?? null : output.trim() || null
		} catch {
			return null
		}
	},
}
