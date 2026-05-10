import { describe, expect, test } from "bun:test"
import { searchGitHubIssues } from "./search"
import type { GitHubIssue } from "./issues"

function makeIssue(overrides: Partial<GitHubIssue> = {}): GitHubIssue {
  return {
    number: 1,
    title: "Add search for github issues",
    body: "Search title, body, labels, and people",
    state: "OPEN",
    url: "https://github.com/owner/repo/issues/1",
    labels: [],
    author: {
      login: "vladimirven001",
      url: "https://github.com/vladimirven001",
    },
    assignees: [],
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-01T00:00:00Z",
    comments: [],
    ...overrides,
  }
}

describe("searchGitHubIssues", () => {
  test("returns original ordering when query is empty", () => {
    const issues = [
      makeIssue({ number: 2, title: "Second" }),
      makeIssue({ number: 1, title: "First" }),
    ]

    expect(searchGitHubIssues(issues, "").map((issue) => issue.number)).toEqual([2, 1])
  })

  test("matches fuzzy title queries", () => {
    const issues = [
      makeIssue({
        number: 1,
        title: "Add search for github issues",
      }),
      makeIssue({
        number: 2,
        title: "Fix tmux issue",
      }),
    ]

    expect(searchGitHubIssues(issues, "githu iss").map((issue) => issue.number)).toEqual([1])
    expect(searchGitHubIssues(issues, "tmx isu").map((issue) => issue.number)).toEqual([2])
  })

  test("searches labels and people", () => {
    const issues = [
      makeIssue({
        number: 1,
        title: "Deploy issue",
        labels: [{ name: "bug", color: "ff0000" }],
        assignees: [{ login: "alice", url: "https://github.com/alice" }],
      }),
      makeIssue({
        number: 2,
        title: "Other issue",
      }),
    ]

    expect(searchGitHubIssues(issues, "bug alice").map((issue) => issue.number)).toEqual([1])
  })

  test("ranks title matches above body-only matches", () => {
    const issues = [
      makeIssue({
        number: 1,
        title: "Search crash",
        body: "Unrelated body",
        updatedAt: "2026-03-01T00:00:00Z",
      }),
      makeIssue({
        number: 2,
        title: "Unrelated title",
        body: "Search crash while loading issues",
        updatedAt: "2026-03-10T00:00:00Z",
      }),
    ]

    expect(searchGitHubIssues(issues, "search crash").map((issue) => issue.number)).toEqual([1, 2])
  })

  test("uses updated time as a tie-breaker for equivalent scores", () => {
    const issues = [
      makeIssue({
        number: 1,
        title: "tmux issue",
        updatedAt: "2026-03-01T00:00:00Z",
      }),
      makeIssue({
        number: 2,
        title: "tmux issue",
        updatedAt: "2026-03-10T00:00:00Z",
      }),
    ]

    expect(searchGitHubIssues(issues, "tmux issue").map((issue) => issue.number)).toEqual([2, 1])
  })
})
