# AGENTS.md - OpenSWE Agent Guidelines

Guidelines for AI agents working on OpenSWE - an AI-powered software engineering orchestration tool.

## Tech Stack

| Component | Tool | Notes |
|-----------|------|-------|
| Runtime | **Bun** (NOT Node.js) | Native SQLite, fast startup |
| Language | TypeScript (strict mode) | Use strict typing everywhere |
| TUI | @opentui/core + @opentui/solid | Solid.js reactivity |
| CLI Parser | yargs | |
| Prompts | @clack/prompts | First-run wizard |
| Database | SQLite via bun:sqlite | Built into Bun |
| Config | TOML via @iarna/toml | snake_case in files, camelCase in code |
| GitHub | gh CLI (shelled out) | Handles auth |
| Sessions | tmux | Process isolation, attach support |

**Build Requirement**: Zig must be installed (OpenTUI native dependency)

## Commands

```bash
bun install                           # Install dependencies
bun run dev                           # Development mode
bun src/index.ts                      # Direct execution
bun --hot src/index.ts                # Hot reloading

bun run build                         # Build to dist/

bun test                              # Run all tests
bun test src/foo.test.ts              # Single test file
bun test --watch                      # Watch mode
bun test --filter "pattern"           # Filter tests

bunx tsc --noEmit                     # Type check without emit
```

## Iteration Finish

- Always run lint/type checks at the end of each iteration (`bunx tsc --noEmit` unless a dedicated lint script exists)

## Project Structure

```
src/
├── index.ts              # CLI entry point with yargs
├── app.tsx               # Main Solid.js TUI application
├── components/           # TUI components (SessionList, Preview, modals)
├── core/                 # Session state machine, tmux manager, parser, queue
├── workspace/            # Detect/init workspace, path utilities
├── github/               # gh CLI wrapper, issues, PR creation
├── git/                  # Clone, worktree operations
├── store/                # SQLite db, sessions/tasks/project CRUD
├── config/               # Types, global loader, defaults, env
├── prompts/              # SWE system prompt template
└── utils/                # Logger, ID generation, formatting
```

## Code Style

### Formatting
- **No semicolons**
- **1-tab indentation**
- **Double quotes** for strings
- **Trailing commas** in multiline structures
- **No emojis** in output, UI strings, or documentation

### Imports (in order)
1. Node.js/Bun built-ins (`os`, `path`, `fs/promises`)
2. External packages (`yargs`, `@iarna/toml`)
3. Relative imports (`./`, `../`)

```typescript
import { homedir } from "os"
import { parse as parseToml } from "@iarna/toml"
import type { GlobalConfig } from "./config/types"
import { logger } from "./utils/logger"
```

### Types
- **Strict mode** - use strict typing everywhere possible; never use `any` without justification
- **Explicit return types** on exported functions
- **Type literals** for constrained values
- **Type guards** for runtime validation

```typescript
export type Phase = "pending" | "research" | "planning" | "coding" | "testing" | "pr_creation" | "completed" | "failed"
export type Status = "queued" | "active" | "paused" | "needs_attention" | "completed" | "failed"

export function isValidPhase(val: unknown): val is Phase {
  return typeof val === "string" && VALID_PHASES.includes(val as Phase)
}
```

### Naming
| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case or camelCase | `session.ts`, `swe-system.ts` |
| Types/Interfaces | PascalCase | `Session`, `HumanTask` |
| Functions | camelCase | `loadConfig`, `createSession` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_CONFIG` |

### Error Handling
- **try-catch** for async operations that may fail
- **Graceful degradation** - return sensible defaults
- **Log warnings** for non-fatal issues
- **Throw errors** only for fatal conditions

### Documentation
```typescript
/**
 * Load and merge configuration from all sources
 * @param cliOverrides - Optional CLI flag overrides
 * @returns Fully resolved configuration
 */
export async function loadConfig(cliOverrides?: CLIOverrides): Promise<GlobalConfig>

// ============================================================================
// Section Headers
// ============================================================================
```

## Bun-Specific APIs

Prefer Bun APIs over Node.js equivalents:

| Use This | Instead Of |
|----------|------------|
| `Bun.file()` / `Bun.write()` | `fs.readFile` / `fs.writeFile` |
| `Bun.$\`cmd\`` | `child_process`, `execa` |
| `bun:sqlite` | `better-sqlite3` |
| `Bun.serve()` | `express` |

Environment variables auto-load from `.env` - don't use `dotenv`.

## Key Data Models

```typescript
interface Session {
  id: string
  name: string
  issueNumber: number | null
  worktreePath: string              // .worktrees/issue-123
  branchName: string                // openswe/issue-123
  phase: Phase
  status: Status
  attentionReason: string | null
  retryCount: number                // 0-2, then needs_attention
  tokensUsed: number
  prUrl: string | null
  pid: number | null
}

interface HumanTask {
  id: string
  sessionId: string
  type: "question" | "permission" | "blocker" | "retry_failed" | "pr_review"
  priority: "high" | "medium" | "low"
  title: string
  context: string
  rawOutput: string
}
```

## Configuration Precedence

1. CLI flags (highest): `--backend`, `--max-sessions`, `--debug`
2. Environment variables: `OPENSWE_BACKEND`, `OPENSWE_LOG_LEVEL`, etc.
3. Global config file: `~/.config/openswe/config.toml`
4. Built-in defaults (lowest)

## Testing

```typescript
import { test, expect, describe } from "bun:test"

describe("Session", () => {
  test("creates session with pending phase", async () => {
    const session = await createSession({ name: "test" })
    expect(session.phase).toBe("pending")
    expect(session.status).toBe("queued")
  })
})
```

## Workspace Model

- **Project-local**: Each workspace tied to single repo
- **Directory-based**: User chooses where to work
- **Worktrees**: Sessions isolated in `.worktrees/{issue-number}/`
- **State**: Project state in `.openswe/state.db`

Detection logic:
1. `.openswe/` exists → Load existing project
2. `.git/` exists → Offer to adopt repo
3. `--repo` flag → Clone to current dir
4. Empty dir → Run setup wizard

## WIP

This project is a WIP, meaning you can overwrite code and make db schema changes. Ensure that best coding practices are followed, even if it means having to reset the local db or make breaking code changes.
