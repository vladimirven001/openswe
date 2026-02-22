/**
 * OpenAI Codex provider implementation
 *
 * Supports the Codex CLI (https://github.com/openai/codex)
 */

import type { Provider, ProviderBranding, ParserPatterns, SpawnCommand, SpawnCommandOptions } from "./types"
import type { Session } from "../store"
import { homedir } from "os"
import { join } from "path"
import { existsSync } from "fs"
import { readdir } from "fs/promises"

async function collectCodexSessionFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true })
	const files: string[] = []

	for (const entry of entries) {
		const fullPath = join(dir, entry.name)
		if (entry.isDirectory()) {
			files.push(...(await collectCodexSessionFiles(fullPath)))
		} else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
			files.push(fullPath)
		}
	}

	return files
}

async function readCodexSessionMeta(filePath: string): Promise<{ id: string; timestamp: number; cwd: string } | null> {
	try {
		const text = await Bun.file(filePath).text()
		const firstLine = text.split("\n")[0]
		if (!firstLine) return null

		const parsed = JSON.parse(firstLine) as {
			type?: string
			payload?: { id?: string; timestamp?: string; cwd?: string }
		}
		if (parsed.type !== "session_meta" || !parsed.payload?.id || !parsed.payload?.timestamp || !parsed.payload?.cwd) {
			return null
		}

		const timestamp = Date.parse(parsed.payload.timestamp)
		if (Number.isNaN(timestamp)) return null

		return {
			id: parsed.payload.id,
			timestamp,
			cwd: parsed.payload.cwd,
		}
	} catch {
		return null
	}
}

async function findCodexSessionId(worktreePath: string, startedAt: number): Promise<string | null> {
	const baseDir = join(homedir(), ".codex", "sessions")
	if (!existsSync(baseDir)) return null

	const files = await collectCodexSessionFiles(baseDir)
	if (files.length === 0) return null

	const entries: Array<{ id: string; timestamp: number }> = []

	for (const filePath of files) {
		const meta = await readCodexSessionMeta(filePath)
		if (!meta) continue
		if (meta.cwd !== worktreePath) continue
		entries.push({ id: meta.id, timestamp: meta.timestamp })
	}

	if (entries.length === 0) return null

	const windowStart = startedAt - 30000
	const recent = entries.filter((entry) => entry.timestamp >= windowStart)
	const candidates = recent.length > 0 ? recent : entries
	if (candidates.length === 0) return null

	let best = candidates[0]!
	let bestDiff = Math.abs(best.timestamp - startedAt)

	for (const entry of candidates.slice(1)) {
		const diff = Math.abs(entry.timestamp - startedAt)
		if (diff < bestDiff) {
			best = entry
			bestDiff = diff
		}
	}

	return best.id
}

// ============================================================================
// Branding
// ============================================================================

const branding: ProviderBranding = {
	displayName: "Codex",
	shortName: "codex",
	accentColor: "#8BE9FD",
	secondaryColor: "#59DFFC",
	logoText: "CX",
	installationUrl: "https://github.com/openai/codex",
}

// ============================================================================
// Parser Patterns
// ============================================================================

const parserPatterns: ParserPatterns = {
	// Codex outputs status messages similarly to Claude Code
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

	isValidSessionId(sessionId: string): boolean {
		return /^[A-Za-z0-9._:-]+$/.test(sessionId) && !sessionId.startsWith("openswe-")
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
		// Resume a previous session
		if (resumeSessionId) {
			const args = [
				"resume", resumeSessionId,
				"--full-auto",
			]

			if (prompt) {
				args.push(prompt)
			}

			return {
				command: "codex",
				args,
			}
		}

		// Start a new session with --full-auto for non-interactive use
		const args = [
			"--full-auto",
		]

		// Add the prompt as the final positional argument
		if (prompt) {
			args.push(prompt)
		}

		return {
			command: "codex",
			args,
		}
	},

	async captureSessionId(input): Promise<string | null> {
		return await findCodexSessionId(input.session.worktreePath, input.startedAt)
	},

	async validateInstallation(): Promise<boolean> {
		try {
			const proc = Bun.spawn(["codex", "--version"], {
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
			// Extract version from output (e.g., "codex v1.2.3" or "1.2.3")
			const match = output.match(/v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/)
			return match ? match[1] ?? null : output.trim() || null
		} catch {
			return null
		}
	},
}
