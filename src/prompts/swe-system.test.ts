import { describe, expect, test } from "bun:test"
import { generateSWEPrompt } from "./swe-system"
import type { Session } from "../store"

function createSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    name: "#24: Fetch issue comments when creating session",
    issueNumber: 24,
    issueTitle: "Fetch issue comments when creating session",
    issueBody: "Fetch the issue's comments and either summarize with ai or put directly in prompt.",
    issueComments: [],
    issueUrl: "https://github.com/example/repo/issues/24",
    worktreePath: "/tmp/worktree",
    branchName: "openswe/issue-24",
    phase: "pending",
    status: "queued",
    attentionReason: null,
    retryCount: 0,
    tokensUsed: 0,
    pid: null,
    aiSessionData: null,
    createdAt: "2026-03-15T00:00:00Z",
    updatedAt: "2026-03-15T00:00:00Z",
    ...overrides,
  }
}

describe("generateSWEPrompt", () => {
  test("includes issue comments when present", () => {
    const prompt = generateSWEPrompt(createSession({
      issueComments: [
        {
          author: "alice",
          body: "First comment with extra detail",
          createdAt: "2026-03-15T00:00:00Z",
          url: "https://github.com/example/repo/issues/24#issuecomment-1",
        },
        {
          author: "bob",
          body: "Second comment",
          createdAt: "2026-03-15T00:00:01Z",
          url: "https://github.com/example/repo/issues/24#issuecomment-2",
        },
      ],
    }))

    expect(prompt).toContain("Issue Comments:")
    expect(prompt).toContain("- alice: First comment with extra detail")
    expect(prompt).toContain("- bob: Second comment")
  })

  test("truncates oversized issue comments", () => {
    const prompt = generateSWEPrompt(createSession({
      issueComments: [{
        author: "alice",
        body: "a".repeat(900),
        createdAt: "2026-03-15T00:00:00Z",
        url: "https://github.com/example/repo/issues/24#issuecomment-1",
      }],
    }))

    expect(prompt).toContain(`${"a".repeat(100)}...`)
    expect(prompt).not.toContain("a".repeat(700))
  })
})
