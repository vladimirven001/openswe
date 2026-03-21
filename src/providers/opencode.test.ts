import { describe, expect, test } from "bun:test"
import { openCodeProvider } from "./opencode"
import { getProvider, getAllProviders, isProviderSupported } from "./registry"
import type { Session } from "../store/types"

// ============================================================================
// Test Helpers
// ============================================================================

function makeSession(overrides: Partial<Session> = {}): Session {
	return {
		id: "test-session-id",
		name: "test-session",
		issueNumber: 42,
		issueTitle: "Test issue",
		issueBody: "Test body",
		issueUrl: "https://github.com/owner/repo/issues/42",
		ticketProvider: "github",
		prUrl: null,
		worktreePath: "/tmp/worktree",
		branchName: "openswe/issue-42",
		phase: "pending",
		status: "queued",
		attentionReason: null,
		retryCount: 0,
		tokensUsed: 0,
		pid: null,
		aiSessionData: null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		...overrides,
	}
}

// ============================================================================
// Provider Identity
// ============================================================================

describe("openCodeProvider", () => {
	test("has correct id and name", () => {
		expect(openCodeProvider.id).toBe("opencode")
		expect(openCodeProvider.name).toBe("OpenCode")
	})

	// ============================================================================
	// Branding
	// ============================================================================

	describe("branding", () => {
		test("has correct accent color", () => {
			expect(openCodeProvider.branding.accentColor).toBe("#cfcecd")
		})

		test("has all required branding fields", () => {
			expect(openCodeProvider.branding.displayName).toBe("OpenCode")
			expect(openCodeProvider.branding.shortName).toBe("opencode")
			expect(openCodeProvider.branding.secondaryColor).toBeTruthy()
			expect(openCodeProvider.branding.logoText).toBe("OC")
		})

		test("has terminal background color", () => {
			expect(openCodeProvider.branding.terminalBackground).toBe("#000000")
		})
	})

	// ============================================================================
	// Parser Patterns
	// ============================================================================

	describe("parserPatterns", () => {
		test("workingRegex matches implementation indicators", () => {
			const { workingRegex } = openCodeProvider.parserPatterns
			expect(workingRegex.test("Starting implementation phase")).toBe(true)
			expect(workingRegex.test("entering coding mode")).toBe(true)
			expect(workingRegex.test("mode: implement")).toBe(true)
		})

		test("workingRegex does not match unrelated text", () => {
			const { workingRegex } = openCodeProvider.parserPatterns
			expect(workingRegex.test("hello world")).toBe(false)
			expect(workingRegex.test("reading files")).toBe(false)
		})

		test("doneRegex matches completion markers", () => {
			const { doneRegex } = openCodeProvider.parserPatterns
			expect(doneRegex.test("[OPENSWE:DONE]")).toBe(true)
			expect(doneRegex.test("OPENSWE:DONE")).toBe(true)
		})

		test("doneRegex does not match unrelated text", () => {
			const { doneRegex } = openCodeProvider.parserPatterns
			expect(doneRegex.test("still working on it")).toBe(false)
			expect(doneRegex.test("hello world")).toBe(false)
		})

		test("has sessionIdRegex for parsing session IDs", () => {
			const { sessionIdRegex } = openCodeProvider.parserPatterns
			expect(sessionIdRegex).toBeDefined()
			const match = "Session ID: ses_abc123".match(sessionIdRegex!)
			expect(match).toBeTruthy()
			expect(match![1]).toBe("ses_abc123")
		})
	})

	// ============================================================================
	// buildSpawnCommand
	// ============================================================================

	describe("session ID lifecycle", () => {
		test("validates provider session IDs", () => {
			expect(openCodeProvider.isValidSessionId("ses_abc123")).toBe(true)
			expect(openCodeProvider.isValidSessionId("openswe-abc123")).toBe(false)
		})

		test("resolves explicit resume session ID when valid", () => {
			const session = makeSession({ aiSessionData: { backend: "opencode", sessionId: "ses_old" } })
			const resumeSessionId = openCodeProvider.getResumeSessionId(session, "ses_new")
			expect(resumeSessionId).toBe("ses_new")
		})

		test("falls back to stored session ID when explicit ID is invalid", () => {
			const session = makeSession({ aiSessionData: { backend: "opencode", sessionId: "ses_old" } })
			const resumeSessionId = openCodeProvider.getResumeSessionId(session, "openswe-bad")
			expect(resumeSessionId).toBe("ses_old")
		})
	})

	describe("buildSpawnCommand", () => {
		test("builds command with prompt", () => {
			const session = makeSession()
			const result = openCodeProvider.buildSpawnCommand(session, "Fix the bug")

			expect(result.command).toBe("opencode")
			expect(result.args).toEqual(["--agent", "plan", "--prompt", "Fix the bug"])
		})

		test("builds command without prompt (interactive mode)", () => {
			const session = makeSession()
			const result = openCodeProvider.buildSpawnCommand(session)

			expect(result.command).toBe("opencode")
			expect(result.args).toEqual([])
		})

		test("builds resume command with session ID", () => {
			const session = makeSession()
			const result = openCodeProvider.buildSpawnCommand(
				session,
				undefined,
				"ses_abc123"
			)

			expect(result.command).toBe("opencode")
			expect(result.args).toEqual(["--session", "ses_abc123"])
		})

		test("resume with prompt includes both --agent/--prompt and --session", () => {
			const session = makeSession()
			const result = openCodeProvider.buildSpawnCommand(
				session,
				"Continue fixing",
				"ses_abc123"
			)

			expect(result.command).toBe("opencode")
			expect(result.args).toContain("--agent")
			expect(result.args).toContain("plan")
			expect(result.args).toContain("--prompt")
			expect(result.args).toContain("Continue fixing")
			expect(result.args).toContain("--session")
			expect(result.args).toContain("ses_abc123")
		})

		test("does not include --model flag", () => {
			const session = makeSession()
			const result = openCodeProvider.buildSpawnCommand(session, "Fix the bug")
			expect(result.args).not.toContain("--model")
		})

		test("does not include env overrides", () => {
			const session = makeSession()
			const result = openCodeProvider.buildSpawnCommand(session, "Fix the bug")
			expect(result.env).toBeUndefined()
		})
	})
})

// ============================================================================
// Registry Integration
// ============================================================================

describe("opencode in registry", () => {
	test("is retrievable via getProvider", () => {
		const provider = getProvider("opencode")
		expect(provider).toBe(openCodeProvider)
	})

	test("is included in getAllProviders", () => {
		const all = getAllProviders()
		const ids = all.map((p) => p.id)
		expect(ids).toContain("opencode")
	})

	test("is recognized by isProviderSupported", () => {
		expect(isProviderSupported("opencode")).toBe(true)
		expect(isProviderSupported("nonexistent")).toBe(false)
	})
})
