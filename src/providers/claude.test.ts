import { describe, expect, test } from "bun:test"
import { claudeProvider } from "./claude"
import type { Session } from "../store/types"

function makeSession(overrides: Partial<Session> = {}): Session {
	return {
		id: "8f57a6b2-6f1e-4e49-a2ad-9c00cfd5cb2f",
		name: "test-session",
		issueNumber: 42,
		issueTitle: "Test issue",
		issueBody: "Test body",
		issueUrl: "https://github.com/owner/repo/issues/42",
		worktreePath: "/tmp/worktree",
		branchName: "openswe/issue-42",
		phase: "pending",
		status: "queued",
		attentionReason: null,
		retryCount: 0,
		tokensUsed: 0,
		pid: null,
		aiSessionData: null,
		openedAt: null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		...overrides,
	}
}

describe("claudeProvider", () => {
	test("validates UUID session IDs", () => {
		expect(claudeProvider.isValidSessionId("8f57a6b2-6f1e-4e49-a2ad-9c00cfd5cb2f")).toBe(true)
		expect(claudeProvider.isValidSessionId("openswe-8f57a6b2")).toBe(false)
	})

	test("resolves explicit resume session ID when valid", () => {
		const session = makeSession({
			aiSessionData: {
				backend: "claude",
				sessionId: "f7f5dce6-3264-4054-beb3-8df40fe4f816",
			},
		})

		const resumeSessionId = claudeProvider.getResumeSessionId(
			session,
			"d63bb3a8-378c-4d0d-a225-787ff634f2ce",
		)

		expect(resumeSessionId).toBe("d63bb3a8-378c-4d0d-a225-787ff634f2ce")
	})

	test("falls back to stored resume session ID when explicit is invalid", () => {
		const session = makeSession({
			aiSessionData: {
				backend: "claude",
				sessionId: "f7f5dce6-3264-4054-beb3-8df40fe4f816",
			},
		})

		const resumeSessionId = claudeProvider.getResumeSessionId(session, "openswe-invalid")
		expect(resumeSessionId).toBe("f7f5dce6-3264-4054-beb3-8df40fe4f816")
	})

	test("buildSpawnCommand only uses --resume for resuming", () => {
		const session = makeSession()
		const command = claudeProvider.buildSpawnCommand(session, "continue work", "f7f5dce6-3264-4054-beb3-8df40fe4f816")

		expect(command.command).toBe("claude")
		expect(command.args).toContain("--resume")
		expect(command.args).toContain("f7f5dce6-3264-4054-beb3-8df40fe4f816")
		expect(command.args).not.toContain("--session-id")
	})
})
