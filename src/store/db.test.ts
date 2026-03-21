/**
 * Database layer tests
 *
 * Tests for all store module functionality.
 */

import { test, expect, beforeEach, afterEach, describe } from "bun:test"
import {
  initDatabaseWithPath,
  closeDatabase,
  getDatabase,
  isDatabaseInitialized,
  getSchemaVersion,
  withTransaction,
} from "./db"
import {
  getProject,
  createProject,
  updateLastOpened,
  projectExists,
  deleteProject,
} from "./project"
import {
  getAllSessions,
  getSession,
  getSessionsByStatus,
  getActiveSessionCount,
  getSessionCount,
  createSession,
  updateSession,
  updateSessionPhase,
  updateSessionStatus,
  incrementRetryCount,
  updateTokensUsed,
  setPid,
  deleteSession,
} from "./sessions"
import {
  getBuffer,
  getRecentLines,
  createBuffer,
  appendLines,
  appendLine,
  setLines,
  clearBuffer,
  MAX_BUFFER_LINES,
} from "./buffers"

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(async () => {
  // Use in-memory database for tests
  await initDatabaseWithPath(":memory:")
})

afterEach(() => {
  closeDatabase()
})

// ============================================================================
// Database Initialization Tests
// ============================================================================

describe("Database Initialization", () => {
  test("initializes database successfully", () => {
    expect(isDatabaseInitialized()).toBe(true)
  })

  test("getDatabase returns database instance", () => {
    const db = getDatabase()
    expect(db).toBeDefined()
  })

  test("schema version is 4", () => {
    const version = getSchemaVersion()
    expect(version).toBe(4)
  })

  test("tables are created", () => {
    const db = getDatabase()
    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all()

    const tableNames = tables.map((t) => t.name)
    expect(tableNames).toContain("project")
    expect(tableNames).toContain("sessions")
    expect(tableNames).toContain("output_buffers")
    expect(tableNames).toContain("schema_version")
  })

  test("closeDatabase closes connection", () => {
    closeDatabase()
    expect(isDatabaseInitialized()).toBe(false)
  })
})

// ============================================================================
// Project CRUD Tests
// ============================================================================

describe("Project Operations", () => {
  test("project does not exist initially", () => {
    expect(projectExists()).toBe(false)
    expect(getProject()).toBeNull()
  })

  test("createProject creates project", () => {
    const project = createProject({
      repoFullName: "owner/repo",
      repoUrl: "git@github.com:owner/repo.git",
    })

    expect(project.id).toBe(1)
    expect(project.repoFullName).toBe("owner/repo")
    expect(project.repoUrl).toBe("git@github.com:owner/repo.git")
    expect(project.createdAt).toBeDefined()
    expect(project.lastOpenedAt).toBeDefined()
  })

  test("getProject retrieves created project", () => {
    createProject({
      repoFullName: "owner/repo",
      repoUrl: "git@github.com:owner/repo.git",
    })

    const project = getProject()
    expect(project).not.toBeNull()
    expect(project!.repoFullName).toBe("owner/repo")
  })

  test("createProject throws if project exists", () => {
    createProject({
      repoFullName: "owner/repo",
      repoUrl: "git@github.com:owner/repo.git",
    })

    expect(() =>
      createProject({
        repoFullName: "other/repo",
        repoUrl: "git@github.com:other/repo.git",
      })
    ).toThrow("Project already exists")
  })

  test("updateLastOpened updates timestamp", async () => {
    createProject({
      repoFullName: "owner/repo",
      repoUrl: "git@github.com:owner/repo.git",
    })

    const before = getProject()!.lastOpenedAt

    // Small delay to ensure timestamp changes
    await new Promise((resolve) => setTimeout(resolve, 10))

    updateLastOpened()

    const after = getProject()!.lastOpenedAt
    expect(after).not.toBe(before)
  })

  test("deleteProject removes project", () => {
    createProject({
      repoFullName: "owner/repo",
      repoUrl: "git@github.com:owner/repo.git",
    })

    expect(projectExists()).toBe(true)
    deleteProject()
    expect(projectExists()).toBe(false)
  })
})

// ============================================================================
// Session CRUD Tests
// ============================================================================

describe("Session Operations", () => {
  test("getAllSessions returns empty initially", () => {
    expect(getAllSessions()).toEqual([])
  })

  test("getSessionCount returns 0 initially", () => {
    expect(getSessionCount()).toBe(0)
  })

  test("createSession creates session with defaults", () => {
    const session = createSession({
      name: "test-session",
      worktreePath: "/path/to/worktree",
      branchName: "openswe/test-session",
    })

    expect(session.id).toBeDefined()
    expect(session.name).toBe("test-session")
    expect(session.worktreePath).toBe("/path/to/worktree")
    expect(session.branchName).toBe("openswe/test-session")
    expect(session.phase).toBe("pending")
    expect(session.status).toBe("queued")
    expect(session.issueNumber).toBeNull()
    expect(session.retryCount).toBe(0)
    expect(session.tokensUsed).toBe(0)
    expect(session.pid).toBeNull()
  })

  test("createSession with issue data", () => {
    const session = createSession({
      name: "issue-123",
      issueNumber: 123,
      issueTitle: "Fix bug",
      issueBody: "Description of bug",
      issueUrl: "https://github.com/owner/repo/issues/123",
      worktreePath: "/path/to/worktree",
      branchName: "openswe/issue-123",
    })

    expect(session.issueNumber).toBe(123)
    expect(session.issueTitle).toBe("Fix bug")
    expect(session.issueBody).toBe("Description of bug")
    expect(session.issueUrl).toBe("https://github.com/owner/repo/issues/123")
  })

  test("getSession retrieves by ID", () => {
    const created = createSession({
      name: "test-session",
      worktreePath: "/path/to/worktree",
      branchName: "openswe/test-session",
    })

    const retrieved = getSession(created.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe(created.id)
    expect(retrieved!.name).toBe("test-session")
  })

  test("getSession returns null for non-existent ID", () => {
    expect(getSession("non-existent-id")).toBeNull()
  })

  test("getAllSessions returns all sessions", () => {
    createSession({
      name: "session-1",
      worktreePath: "/path/1",
      branchName: "openswe/session-1",
    })
    createSession({
      name: "session-2",
      worktreePath: "/path/2",
      branchName: "openswe/session-2",
    })

    const sessions = getAllSessions()
    expect(sessions.length).toBe(2)
  })

  test("getSessionsByStatus filters correctly", () => {
    const session1 = createSession({
      name: "session-1",
      worktreePath: "/path/1",
      branchName: "openswe/session-1",
    })
    createSession({
      name: "session-2",
      worktreePath: "/path/2",
      branchName: "openswe/session-2",
    })

    updateSessionStatus(session1.id, "active")

    const active = getSessionsByStatus("active")
    expect(active.length).toBe(1)
    expect(active[0]?.name).toBe("session-1")

    const queued = getSessionsByStatus("queued")
    expect(queued.length).toBe(1)
    expect(queued[0]?.name).toBe("session-2")
  })

  test("getActiveSessionCount counts active sessions", () => {
    const session1 = createSession({
      name: "session-1",
      worktreePath: "/path/1",
      branchName: "openswe/session-1",
    })
    createSession({
      name: "session-2",
      worktreePath: "/path/2",
      branchName: "openswe/session-2",
    })

    expect(getActiveSessionCount()).toBe(0)

    updateSessionStatus(session1.id, "active")
    expect(getActiveSessionCount()).toBe(1)
  })

  test("updateSession updates multiple fields", () => {
    const session = createSession({
      name: "test-session",
      worktreePath: "/path/to/worktree",
      branchName: "openswe/test-session",
    })

    const updated = updateSession(session.id, {
      name: "new-name",
      phase: "working",
      status: "active",
      tokensUsed: 1000,
    })

    expect(updated.name).toBe("new-name")
    expect(updated.phase).toBe("working")
    expect(updated.status).toBe("active")
    expect(updated.tokensUsed).toBe(1000)
  })

  test("updateSessionPhase updates phase", () => {
    const session = createSession({
      name: "test-session",
      worktreePath: "/path/to/worktree",
      branchName: "openswe/test-session",
    })

    updateSessionPhase(session.id, "planning")
    expect(getSession(session.id)!.phase).toBe("planning")

    updateSessionPhase(session.id, "working")
    expect(getSession(session.id)!.phase).toBe("working")
  })

  test("updateSessionStatus with attention reason", () => {
    const session = createSession({
      name: "test-session",
      worktreePath: "/path/to/worktree",
      branchName: "openswe/test-session",
    })

    updateSessionStatus(session.id, "needs_attention", "AI needs clarification")

    const updated = getSession(session.id)!
    expect(updated.status).toBe("needs_attention")
    expect(updated.attentionReason).toBe("AI needs clarification")
  })

  test("updateSessionStatus clears attention reason for other statuses", () => {
    const session = createSession({
      name: "test-session",
      worktreePath: "/path/to/worktree",
      branchName: "openswe/test-session",
    })

    updateSessionStatus(session.id, "needs_attention", "Needs help")
    updateSessionStatus(session.id, "active")

    const updated = getSession(session.id)!
    expect(updated.status).toBe("active")
    expect(updated.attentionReason).toBeNull()
  })

  test("incrementRetryCount increments and returns new value", () => {
    const session = createSession({
      name: "test-session",
      worktreePath: "/path/to/worktree",
      branchName: "openswe/test-session",
    })

    expect(incrementRetryCount(session.id)).toBe(1)
    expect(incrementRetryCount(session.id)).toBe(2)
    expect(incrementRetryCount(session.id)).toBe(3)
  })

  test("updateTokensUsed sets tokens", () => {
    const session = createSession({
      name: "test-session",
      worktreePath: "/path/to/worktree",
      branchName: "openswe/test-session",
    })

    updateTokensUsed(session.id, 5000)
    expect(getSession(session.id)!.tokensUsed).toBe(5000)
  })

  test("setPid sets and clears PID", () => {
    const session = createSession({
      name: "test-session",
      worktreePath: "/path/to/worktree",
      branchName: "openswe/test-session",
    })

    setPid(session.id, 12345)
    expect(getSession(session.id)!.pid).toBe(12345)

    setPid(session.id, null)
    expect(getSession(session.id)!.pid).toBeNull()
  })

  test("deleteSession removes session", () => {
    const session = createSession({
      name: "test-session",
      worktreePath: "/path/to/worktree",
      branchName: "openswe/test-session",
    })

    expect(getSession(session.id)).not.toBeNull()
    deleteSession(session.id)
    expect(getSession(session.id)).toBeNull()
  })
})

// ============================================================================
// Human Task CRUD Tests - REMOVED
// ============================================================================

// ============================================================================
// Output Buffer Tests
// ============================================================================

describe("Output Buffer Operations", () => {
  let sessionId: string

  beforeEach(() => {
    const session = createSession({
      name: "test-session",
      worktreePath: "/path/to/worktree",
      branchName: "openswe/test-session",
    })
    sessionId = session.id
  })

  test("getBuffer returns null for non-existent buffer", () => {
    expect(getBuffer(sessionId)).toBeNull()
  })

  test("createBuffer creates empty buffer", () => {
    const buffer = createBuffer(sessionId)

    expect(buffer.sessionId).toBe(sessionId)
    expect(buffer.lines).toEqual([])
    expect(buffer.lastUpdated).toBeDefined()
  })

  test("getBuffer retrieves created buffer", () => {
    createBuffer(sessionId)

    const buffer = getBuffer(sessionId)
    expect(buffer).not.toBeNull()
    expect(buffer!.sessionId).toBe(sessionId)
  })

  test("appendLines adds lines", () => {
    createBuffer(sessionId)

    appendLines(sessionId, ["line 1", "line 2"])

    const buffer = getBuffer(sessionId)!
    expect(buffer.lines).toEqual(["line 1", "line 2"])
  })

  test("appendLines creates buffer if needed", () => {
    appendLines(sessionId, ["line 1"])

    const buffer = getBuffer(sessionId)
    expect(buffer).not.toBeNull()
    expect(buffer!.lines).toEqual(["line 1"])
  })

  test("appendLine appends single line", () => {
    appendLine(sessionId, "line 1")
    appendLine(sessionId, "line 2")

    const buffer = getBuffer(sessionId)!
    expect(buffer.lines).toEqual(["line 1", "line 2"])
  })

  test("getRecentLines returns last N lines", () => {
    appendLines(sessionId, ["line 1", "line 2", "line 3", "line 4", "line 5"])

    expect(getRecentLines(sessionId, 3)).toEqual(["line 3", "line 4", "line 5"])
    expect(getRecentLines(sessionId, 10)).toEqual([
      "line 1",
      "line 2",
      "line 3",
      "line 4",
      "line 5",
    ])
  })

  test("getRecentLines returns empty for non-existent buffer", () => {
    expect(getRecentLines(sessionId, 10)).toEqual([])
  })

  test("circular buffer drops oldest lines", () => {
    // Create lines that exceed MAX_BUFFER_LINES
    const manyLines = Array.from({ length: MAX_BUFFER_LINES + 100 }, (_, i) => `line ${i}`)

    appendLines(sessionId, manyLines)

    const buffer = getBuffer(sessionId)!
    expect(buffer.lines.length).toBe(MAX_BUFFER_LINES)
    expect(buffer.lines[0]).toBe("line 100")
    expect(buffer.lines[MAX_BUFFER_LINES - 1]).toBe(`line ${MAX_BUFFER_LINES + 99}`)
  })

  test("setLines replaces all lines", () => {
    appendLines(sessionId, ["old 1", "old 2"])

    setLines(sessionId, ["new 1", "new 2", "new 3"])

    const buffer = getBuffer(sessionId)!
    expect(buffer.lines).toEqual(["new 1", "new 2", "new 3"])
  })

  test("clearBuffer empties buffer", () => {
    appendLines(sessionId, ["line 1", "line 2"])

    clearBuffer(sessionId)

    const buffer = getBuffer(sessionId)!
    expect(buffer.lines).toEqual([])
  })

  test("cascade delete removes buffer when session deleted", () => {
    createBuffer(sessionId)
    appendLines(sessionId, ["line 1"])

    expect(getBuffer(sessionId)).not.toBeNull()

    deleteSession(sessionId)

    expect(getBuffer(sessionId)).toBeNull()
  })
})

// ============================================================================
// Transaction Tests
// ============================================================================

describe("Transactions", () => {
  test("withTransaction commits on success", () => {
    const result = withTransaction(() => {
      createSession({
        name: "session-1",
        worktreePath: "/path/1",
        branchName: "openswe/session-1",
      })
      createSession({
        name: "session-2",
        worktreePath: "/path/2",
        branchName: "openswe/session-2",
      })
      return "done"
    })

    expect(result).toBe("done")
    expect(getAllSessions().length).toBe(2)
  })

  test("withTransaction rolls back on error", () => {
    try {
      withTransaction(() => {
        createSession({
          name: "session-1",
          worktreePath: "/path/1",
          branchName: "openswe/session-1",
        })
        throw new Error("Rollback!")
      })
    } catch {
      // Expected
    }

    expect(getAllSessions().length).toBe(0)
  })
})
