/**
 * OpenCode provider implementation
 *
 * Supports the OpenCode CLI (https://github.com/anomalyco/opencode)
 */

import { which } from "bun"
import type { Provider, ProviderBranding, ParserPatterns, SpawnCommand, SpawnCommandOptions } from "./types"
import type { Session } from "../store"

function parseOpenCodeSessionList(output: string): Array<{ id: string; title: string }> {
	const results: Array<{ id: string; title: string }> = []
	const lines = output.split("\n")
	const rowRegex = /^(ses_[A-Za-z0-9_-]+)\s+(.*?)\s{2,}.+$/

	for (const line of lines) {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith("Session ID") || /^[-\s]+$/.test(trimmed)) {
			continue
		}

		const match = trimmed.match(rowRegex)
		if (!match) continue

		const id = match[1]
		const title = match[2]
		if (id && title) {
			results.push({ id, title })
		}
	}

	return results
}

// ============================================================================
// Branding
// ============================================================================

const branding: ProviderBranding = {
	displayName: "OpenCode",
	shortName: "opencode",
	accentColor: "#cfcecd",
	secondaryColor: "#f1ecec",
	logoText: "OC",
	terminalBackground: "#000000",
	installationUrl: "https://opencode.ai/install",
}

// ============================================================================
// Parser Patterns
// ============================================================================

const parserPatterns: ParserPatterns = {
	workingRegex: /(?:starting|begin|entering).+(?:implementation|coding|execution)|(?:mode|status):\s*(?:implement|coding)/i,
	doneRegex: /\[?OPENSWE:DONE\]?/i,
	sessionIdRegex: /(?:Session ID|session id):\s*([a-zA-Z0-9_-]+)/i,
}

// ============================================================================
// Provider Implementation
// ============================================================================

export const openCodeProvider: Provider = {
	id: "opencode",
	name: "OpenCode",
	branding,
	parserPatterns,

	isValidSessionId(sessionId: string): boolean {
		return /^ses_[A-Za-z0-9_-]+$/.test(sessionId)
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
		options?: SpawnCommandOptions
	): SpawnCommand {
		const args: string[] = []

		if (prompt) {
			args.push("--agent", "plan", "--prompt", prompt)
		}

		if (resumeSessionId) {
			args.push("--session", resumeSessionId)
		}

		return {
			command: "opencode",
			args,
		}
	},

	async listSessions(): Promise<Array<{ id: string; title: string }> | null> {
		try {
			const proc = Bun.spawn(["opencode", "session", "list"], {
				stdout: "pipe",
				stderr: "pipe",
			})
			const exitCode = await proc.exited
			if (exitCode !== 0) return null

			const output = await new Response(proc.stdout).text()
			return parseOpenCodeSessionList(output)
		} catch {
			return null
		}
	},

	async validateInstallation(): Promise<boolean> {
		return which("opencode") !== null
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
