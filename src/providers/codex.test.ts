import { describe, expect, test } from "bun:test"
import { codexProvider } from "./codex"
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

describe("codexProvider", () => {
	test("has correct id and name", () => {
		expect(codexProvider.id).toBe("codex")
		expect(codexProvider.name).toBe("Codex")
	})

	// ============================================================================
	// Branding
	// ============================================================================

	describe("branding", () => {
		test("has OpenAI green accent color", () => {
			expect(codexProvider.branding.accentColor).toBe("#8BE9FD")
		})

		test("has all required branding fields", () => {
			expect(codexProvider.branding.displayName).toBe("Codex")
			expect(codexProvider.branding.shortName).toBe("codex")
			expect(codexProvider.branding.secondaryColor).toBeTruthy()
			expect(codexProvider.branding.logoText).toBe("CX")
		})
	})

	// ============================================================================
	// Parser Patterns
	// ============================================================================

	describe("parserPatterns", () => {
		test("workingRegex matches implementation indicators", () => {
			const { workingRegex } = codexProvider.parserPatterns
			expect(workingRegex.test("Starting implementation")).toBe(true)
			expect(workingRegex.test("editing file")).toBe(true)
			expect(workingRegex.test("writing a file")).toBe(true)
		})

		test("doneRegex matches completion markers", () => {
			const { doneRegex } = codexProvider.parserPatterns
			expect(doneRegex.test("[OPENSWE:DONE]")).toBe(true)
			expect(doneRegex.test("OPENSWE:DONE")).toBe(true)
			expect(doneRegex.test("completed successfully")).toBe(true)
			expect(doneRegex.test("task completed")).toBe(true)
		})

		test("doneRegex does not match unrelated text", () => {
			const { doneRegex } = codexProvider.parserPatterns
			expect(doneRegex.test("still working on it")).toBe(false)
			expect(doneRegex.test("hello world")).toBe(false)
		})
	})

	// ============================================================================
	// buildSpawnCommand
	// ============================================================================

	describe("session ID lifecycle", () => {
		test("rejects openswe tmux session names", () => {
			expect(codexProvider.isValidSessionId("openswe-abc123")).toBe(false)
			expect(codexProvider.isValidSessionId("session_abc123")).toBe(true)
		})

		test("prefers explicit resume session ID when valid", () => {
			const session = makeSession({ aiSessionData: { backend: "codex", sessionId: "stored_id" } })
			const resumeSessionId = codexProvider.getResumeSessionId(session, "explicit_id")
			expect(resumeSessionId).toBe("explicit_id")
		})

		test("uses stored session ID when explicit ID is invalid", () => {
			const session = makeSession({ aiSessionData: { backend: "codex", sessionId: "stored_id" } })
			const resumeSessionId = codexProvider.getResumeSessionId(session, "openswe-invalid")
			expect(resumeSessionId).toBe("stored_id")
		})
	})

	describe("buildSpawnCommand", () => {
		test("builds basic command with prompt", () => {
			const session = makeSession()
			const result = codexProvider.buildSpawnCommand(session, "Fix the bug")

			expect(result.command).toBe("codex")
			expect(result.args).toContain("--full-auto")
			expect(result.args).toContain("Fix the bug")
			// Provider uses its own default model - no --model flag
			expect(result.args).not.toContain("--model")
		})

		test("builds command without prompt", () => {
			const session = makeSession()
			const result = codexProvider.buildSpawnCommand(session)

			expect(result.command).toBe("codex")
			expect(result.args).toContain("--full-auto")
			// Provider uses its own default model - no --model flag
			expect(result.args).not.toContain("--model")
			// No prompt in args
			expect(result.args).toEqual(["--full-auto"])
		})

		test("builds resume command with session ID", () => {
			const session = makeSession()
			const result = codexProvider.buildSpawnCommand(
				session,
				undefined,
				"prev-session-123"
			)

			expect(result.command).toBe("codex")
			expect(result.args[0]).toBe("resume")
			expect(result.args[1]).toBe("prev-session-123")
			expect(result.args).toContain("--full-auto")
			// Provider uses its own default model - no --model flag
			expect(result.args).not.toContain("--model")
		})

		test("resume command includes prompt when provided", () => {
			const session = makeSession()
			const result = codexProvider.buildSpawnCommand(
				session,
				"Continue fixing",
				"prev-session-123"
			)

			expect(result.args[0]).toBe("resume")
			expect(result.args[1]).toBe("prev-session-123")
			expect(result.args).toContain("Continue fixing")
		})
	})
})

// ============================================================================
// Registry Integration
// ============================================================================

describe("codex in registry", () => {
	test("is retrievable via getProvider", () => {
		const provider = getProvider("codex")
		expect(provider).toBe(codexProvider)
	})

	test("is included in getAllProviders", () => {
		const all = getAllProviders()
		const ids = all.map((p) => p.id)
		expect(ids).toContain("codex")
	})

	test("is recognized by isProviderSupported", () => {
		expect(isProviderSupported("codex")).toBe(true)
		expect(isProviderSupported("nonexistent")).toBe(false)
	})
})