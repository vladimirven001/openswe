/**
 * OpenCode provider implementation
 *
 * Supports the OpenCode CLI (https://github.com/opencode-ai/opencode)
 */

import type { Provider, ProviderBranding, ParserPatterns, SpawnCommand } from "./types"
import type { Session } from "../store"
import type { OpenCodeConfig } from "../config/types"

// ============================================================================
// Branding
// ============================================================================

const branding: ProviderBranding = {
	displayName: "OpenCode",
	shortName: "opencode",
	accentColor: "#fab283",
	secondaryColor: "#d4956b",
	logoText: "OC",
	terminalBackground: "#000000",
}

// ============================================================================
// Parser Patterns
// ============================================================================

const parserPatterns: ParserPatterns = {
	workingRegex: /(?:starting|begin|entering).+(?:implementation|coding|execution)|(?:mode|status):\s*(?:implement|coding)/i,
	doneRegex: /\[?OPENSWE:DONE\]?/i,
}

// ============================================================================
// Provider Implementation
// ============================================================================

export const openCodeProvider: Provider = {
	id: "opencode",
	name: "OpenCode",
	branding,
	parserPatterns,

	buildSpawnCommand(
		_session: Session,
		prompt: string,
		resumeSessionId?: string,
		config?: Record<string, unknown>
	): SpawnCommand {
		const openCodeConfig = config as OpenCodeConfig | undefined
		const model = openCodeConfig?.model ?? "big-pickle"
		const provider = openCodeConfig?.provider ?? "opencode"

		const args = [
			"--model", `${provider}/${model}`,
			"--agent", "plan",
			"--prompt", prompt,
		]

		if (resumeSessionId) {
			args.push("--session", resumeSessionId)
		}

		return {
			command: "opencode",
			args,
		}
	},

	async validateInstallation(): Promise<boolean> {
		try {
			const proc = Bun.spawn(["which", "opencode"], {
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
			const proc = Bun.spawn(["opencode", "--version"], {
				stdout: "pipe",
				stderr: "pipe",
			})
			const exitCode = await proc.exited
			if (exitCode !== 0) return null

			const output = await new Response(proc.stdout).text()
			// Extract version from output (e.g., "opencode v1.2.3" or just "1.2.3")
			const match = output.match(/v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/)
			return match ? match[1] ?? null : output.trim() || null
		} catch {
			return null
		}
	},
}
