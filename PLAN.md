OpenSWE - Complete Implementation Plan (v2)
---
Overview
OpenSWE is a terminal-based UI application that orchestrates multiple AI coding sessions to tackle GitHub issues asynchronously. Each session replicates the workflow of a Software Engineer: Issue → Research → Plan → Code → Test → PR.
The app uses a project-local workspace model - users create a directory, run openswe, and link a repo. All work (clones, worktrees, sessions) stays in that directory, allowing users to organize their work however they prefer.
---
Core Philosophy
The app embodies the SWE mindset:
- Each session is an autonomous "engineer" working on a task
- Engineers follow a structured workflow (research → plan → code → test → PR)
- A human manager (the user) oversees multiple engineers
- Engineers escalate blockers/questions to the manager via a task queue
- Work is isolated per issue using git worktrees (like separate workstations)
- Projects are directory-based, matching how developers actually work
---
Key Design Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Workspace Model | Project-local (directory-based) | Matches developer workflow, flexible organization |
| AI Backend | User choice at startup (Opencode first) | Flexibility, Opencode is primary target |
| Completion Signal | [OPENSWE:DONE] marker | Works regardless of AI backend |
| Session Interaction | Full takeover mode | User can intervene and guide AI directly |
| Failure Handling | Auto-retry 2x → human queue | Balance automation with oversight |
| SWE Phases | Visible in UI | Transparency into what the AI is doing |
| Issue Priority | Manual queue | User selects which issues to work on |
| Repo Isolation | Git worktrees in .worktrees/ | Clean, contained, easy to gitignore |
| Config Split | Global preferences + local state | Separation of concerns |
| Notifications | TUI indicators only | Badges, colors, no system notifications |
| Human Tasks | Dedicated modal (t key) | Clear separation, jump-to-session action |
| Worktree Location | .worktrees/ subdirectory | Doesn't clutter main repo |
| Fresh Clone Location | Current directory | Simple, intuitive |
---
Tech Stack
| Component | Tool | Rationale |
|-----------|------|-----------|
| Runtime | Bun | Native SQLite, fast startup, excellent TS support |
| Language | TypeScript | Type safety, same as Opencode |
| TUI Framework | @opentui/core + @opentui/solid | Same as Opencode, Solid.js reactivity |
| CLI Parser | yargs | Same as Opencode |
| Interactive Prompts | @clack/prompts | Beautiful first-run wizard |
| Database | SQLite via bun:sqlite | Built into Bun, zero dependencies |
| Config Format | TOML via @iarna/toml | Human-readable, standard for CLI tools |
| GitHub API | gh CLI (shelled out) | Already installed for most devs, handles auth |
| PTY | bun-pty | Pseudo-terminal for subprocess management |
Build Requirement: Zig must be installed (OpenTUI native dependency)
---
Workspace Model
Design Principles
1. Project-based: Each OpenSWE workspace is tied to a single repo
2. Location-flexible: User chooses where to work
3. Existing repo friendly: Can adopt an already-cloned repository
4. Clean separation: Global preferences vs local project state
Scenarios
Scenario A: Fresh start (empty directory)
mkdir ~/work/auth-fixes && cd ~/work/auth-fixes
openswe --repo owner/repo
~/work/auth-fixes/                # User's chosen workspace
├── .openswe/                     # Project state (gitignored)
│   ├── state.db                  # Sessions, tasks, buffers
│   └── logs/
├── .git/                         # Main repo cloned here
├── .gitignore                    # Updated to include .openswe/, .worktrees/
├── src/                          # Repo contents
├── package.json
└── .worktrees/                   # Worktrees subdirectory
    ├── issue-123/
    ├── issue-456/
    └── manual-session/
Scenario B: Existing cloned repo
cd ~/projects/my-existing-repo    # Already has .git
openswe                           # Detects repo, links automatically
~/projects/my-existing-repo/
├── .git/                         # Existing
├── .openswe/                     # Added by OpenSWE
│   ├── state.db
│   └── logs/
├── src/                          # Existing repo contents
└── .worktrees/                   # Worktrees created here
    ├── issue-123/
    └── issue-456/
Scenario C: Returning to existing OpenSWE project
cd ~/work/auth-fixes              # Has .openswe/ already
openswe                           # Loads existing project state
Startup Detection Logic
async function initWorkspace(cwd: string, options: CLIOptions) {
  const hasOpenSWE = await exists(join(cwd, '.openswe'));
  const hasGit = await exists(join(cwd, '.git'));
  
  if (hasOpenSWE) {
    // Existing OpenSWE project - load and continue
    return loadExistingProject(cwd);
  }
  
  if (hasGit) {
    // Existing git repo - offer to adopt it
    const repoUrl = await getGitRemoteUrl(cwd);
    const confirmed = await confirmAdoptRepo(repoUrl);
    if (!confirmed) process.exit(0);
    return initProjectFromExistingRepo(cwd, repoUrl);
  }
  
  if (options.repo) {
    // Empty dir + repo specified via CLI - clone directly
    await cloneRepo(options.repo, cwd);
    return initNewProject(cwd, options.repo);
  }
  
  // Empty dir, no repo - run full wizard
  const config = await runSetupWizard();
  await cloneRepo(config.repo, cwd);
  return initNewProject(cwd, config.repo);
}
---
Configuration System
Global Config
Location: ~/.config/openswe/config.toml
Contains user preferences that apply across all projects:
# ~/.config/openswe/config.toml
[ai]
backend = "opencode"                # "opencode" | "claude"
[ai.opencode]
model = "claude-sonnet"
provider = "anthropic"
[ai.claude]
model = "opus"
[defaults]
max_active_sessions = 5             # Default for new projects
[pr]
auto_create = true
draft = true
title_template = "{{issue_title}}"
body_template = """
Fixes #{{issue_number}}
## Summary
{{ai_summary}}
---
*Automated by OpenSWE*
"""
[keybindings]
navigate_up = "k"
navigate_down = "j"
select = "Enter"
new_session = "n"
delete_session = "d"
pause_session = "p"
task_queue = "t"
issues = "i"
quit = "q"
help = "?"
[advanced]
log_level = "info"                  # "debug" | "info" | "warn" | "error"
Local Project State
Location: .openswe/state.db (SQLite)
Contains project-specific data:
- Linked repository info
- Sessions and their states
- Human tasks
- Output buffers
- Project-specific overrides (optional)
Config Precedence
1. CLI flags (highest)
2. Environment variables (OPENSWE_*)
3. Global config file
4. Built-in defaults (lowest)
---
Data Models
Session
interface Session {
  id: string;                      // UUID
  name: string;                    // AI-generated or user-provided
  
  // Issue linkage (null for manual sessions)
  issueNumber: number | null;
  issueTitle: string | null;
  issueBody: string | null;
  issueUrl: string | null;
  
  // Workspace paths
  worktreePath: string;            // .worktrees/issue-123
  branchName: string;              // openswe/issue-123
  
  // SWE workflow tracking
  phase: Phase;
  status: Status;
  attentionReason: string | null;  // Why needs attention
  retryCount: number;              // 0-2, then needs_attention
  
  // Metrics
  tokensUsed: number;
  
  // PR info
  prUrl: string | null;
  
  // Process info (for reattach after restart)
  pid: number | null;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
type Phase = 
  | 'pending'       // Not started
  | 'research'      // Understanding the codebase
  | 'planning'      // Creating implementation plan
  | 'coding'        // Writing code
  | 'testing'       // Running tests
  | 'pr_creation'   // Creating pull request
  | 'completed'     // Done
  | 'failed';       // Failed permanently
type Status =
  | 'queued'          // Waiting to start (respecting max active limit)
  | 'active'          // Currently running
  | 'paused'          // Manually paused by user
  | 'needs_attention' // Waiting for human input
  | 'completed'       // Successfully finished
  | 'failed';         // Failed after retries
Human Task
interface HumanTask {
  id: string;                      // UUID
  sessionId: string;               // FK to Session
  sessionName: string;             // Denormalized for display
  issueNumber: number | null;      // Denormalized for display
  
  type: TaskType;
  priority: 'high' | 'medium' | 'low';
  
  title: string;                   // Brief description
  context: string;                 // What the AI was doing when triggered
  rawOutput: string;               // The actual question/request text
  
  createdAt: Date;
  resolvedAt: Date | null;         // When user addressed it
}
type TaskType =
  | 'question'      // AI asked a question (question tool)
  | 'permission'    // AI needs permission (run command, install, etc.)
  | 'blocker'       // AI hit a blocker ([OPENSWE:BLOCKER:...])
  | 'retry_failed'  // Failed after 2 auto-retries
  | 'pr_review';    // PR created, ready for review
Project State
interface ProjectState {
  // Repository info
  repoFullName: string;            // "owner/repo"
  repoUrl: string;                 // git@github.com:owner/repo.git
  
  // Paths (relative to project root)
  projectRoot: string;             // Absolute path to workspace
  worktreesDir: string;            // ".worktrees"
  
  // Optional overrides
  maxActiveSessions: number | null; // null = use global default
  
  // Timestamps
  createdAt: Date;
  lastOpenedAt: Date;
}
Output Buffer
interface OutputBuffer {
  sessionId: string;
  lines: string[];                 // Circular buffer (max ~1000 lines)
  lastUpdated: Date;
}
Global Config Types
interface GlobalConfig {
  ai: {
    backend: 'opencode' | 'claude';
    opencode: {
      model: string;
      provider: string;
    };
    claude: {
      model: string;
    };
  };
  defaults: {
    maxActiveSessions: number;
  };
  pr: {
    autoCreate: boolean;
    draft: boolean;
    titleTemplate: string;
    bodyTemplate: string;
  };
  keybindings: {
    navigateUp: string;
    navigateDown: string;
    select: string;
    newSession: string;
    deleteSession: string;
    pauseSession: string;
    taskQueue: string;
    issues: string;
    quit: string;
    help: string;
  };
  advanced: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}
---
Database Schema
Location: .openswe/state.db
-- Project metadata (singleton)
CREATE TABLE project (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  repo_full_name TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  max_active_sessions INTEGER,        -- NULL = use global default
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_opened_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  issue_number INTEGER,
  issue_title TEXT,
  issue_body TEXT,
  issue_url TEXT,
  worktree_path TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'queued',
  attention_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  pr_url TEXT,
  pid INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Human tasks table
CREATE TABLE human_tasks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_name TEXT NOT NULL,
  issue_number INTEGER,
  type TEXT NOT NULL,
  priority TEXT NOT NULL,
  title TEXT NOT NULL,
  context TEXT,
  raw_output TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
-- Output buffers table  
CREATE TABLE output_buffers (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  lines TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Indexes for common queries
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_phase ON sessions(phase);
CREATE INDEX idx_tasks_session ON human_tasks(session_id);
CREATE INDEX idx_tasks_unresolved ON human_tasks(resolved_at) WHERE resolved_at IS NULL;
---
SWE System Prompt
Injected when starting an AI session:
export function generateSystemPrompt(session: Session): string {
  return `
You are a Software Engineer working autonomously on a task.
## Your Current Task
${session.issueNumber ? `
Issue #${session.issueNumber}: "${session.issueTitle}"
${session.issueBody}
` : `
Task: ${session.name}
`}
## Workflow
Follow this structured workflow:
1. **Research** - Understand the codebase, find relevant files, read documentation
2. **Planning** - Create a clear plan before writing code
3. **Coding** - Implement changes incrementally with atomic commits
4. **Testing** - Run tests, fix any failures
5. **PR Creation** - Create a pull request with clear description
## Communication Markers
Use these markers to communicate your progress (IMPORTANT - the orchestrator parses these):
- \`[OPENSWE:PHASE:research]\` - When starting research phase
- \`[OPENSWE:PHASE:planning]\` - When creating your plan  
- \`[OPENSWE:PHASE:coding]\` - When implementing changes
- \`[OPENSWE:PHASE:testing]\` - When running tests
- \`[OPENSWE:PHASE:pr_creation]\` - When creating the PR
- \`[OPENSWE:DONE]\` - When PR is created and work is complete
- \`[OPENSWE:BLOCKER:description]\` - When you need human input to proceed
## Guidelines
- Work autonomously - minimize questions, make reasonable decisions
- Create atomic, well-tested commits with clear messages
- Write comprehensive PR descriptions
- Only use [OPENSWE:BLOCKER:...] when truly stuck
- Signal [OPENSWE:DONE] only after PR is successfully created
Begin by outputting [OPENSWE:PHASE:research] and exploring the codebase.
`;
}
---
Output Parsing
The app parses AI output in real-time for markers:
| Marker | Regex | Action |
|--------|-------|--------|
| [OPENSWE:PHASE:research] | \[OPENSWE:PHASE:(\w+)\] | Update session.phase |
| [OPENSWE:PHASE:planning] | | Update session.phase |
| [OPENSWE:PHASE:coding] | | Update session.phase |
| [OPENSWE:PHASE:testing] | | Update session.phase |
| [OPENSWE:PHASE:pr_creation] | | Update session.phase |
| [OPENSWE:DONE] | \[OPENSWE:DONE\] | Mark session complete |
| [OPENSWE:BLOCKER:*] | \[OPENSWE:BLOCKER:(.+)\] | Create HumanTask, set needs_attention |
Heuristic Detection (AI tool patterns):
- Question prompts → Create HumanTask (type: question)
- Permission requests → Create HumanTask (type: permission)
- Repeated errors → Increment retryCount
---
Session State Machine
                    ┌──────────┐
                    │  queued  │ ←── Created, waiting for slot
                    └────┬─────┘
                         │ (slot available, start process)
                         ▼
                    ┌──────────┐
          ┌────────→│  active  │←────────┐
          │         └────┬─────┘         │
          │              │               │
          │   ┌──────────┼──────────┐    │
          │   │          │          │    │
          │   ▼          ▼          ▼    │
     ┌────────┐   ┌───────────┐  ┌──────┴───┐
     │ paused │   │ needs_    │  │  error   │
     │        │   │ attention │  │  (temp)  │
     └────┬───┘   └─────┬─────┘  └────┬─────┘
          │             │             │
          │   (user     │ (user       │ (retry < 2)
          │   resumes)  │ resolves)   │
          └─────────────┴─────────────┘
                         │
                         │ ([OPENSWE:DONE] detected)
                         ▼
                    ┌──────────┐
                    │completed │
                    └──────────┘
                         │ (retry >= 2, unresolved blocker)
                         ▼
                    ┌──────────┐
                    │  failed  │ (permanent)
                    └──────────┘
---
Git Worktree Management
Commands
# Create worktree for issue #123
cd /path/to/project              # Main repo
git worktree add .worktrees/issue-123 -b openswe/issue-123
# List worktrees
git worktree list
# Remove worktree (when session deleted)
git worktree remove .worktrees/issue-123
git branch -d openswe/issue-123  # Optional: delete branch too
Worktree Structure
project-root/
├── .git/                         # Main git directory
├── .worktrees/
│   ├── issue-123/
│   │   ├── .git                  # File pointing to main .git
│   │   ├── src/
│   │   └── ...                   # Full working copy
│   └── issue-456/
│       └── ...
Branch Naming Convention
- Issue-linked: openswe/issue-{number} (e.g., openswe/issue-123)
- Manual session: openswe/{sanitized-name} (e.g., openswe/refactor-auth)
---
Human Task Queue
Triggers
| Trigger | Priority | TaskType |
|---------|----------|----------|
| AI uses question tool | High | question |
| AI requests permission | High | permission |
| [OPENSWE:BLOCKER:*] detected | High | blocker |
| Failed after 2 retries | Medium | retry_failed |
| PR created successfully | Low | pr_review |
Behavior
1. Task created → Badge counter increments in StatusBar
2. User presses t → TaskQueueModal opens
3. User selects task → Jumps into that session at the relevant point
4. User resolves (answers question, grants permission, etc.)
5. Task marked resolved, session continues
---
UI Layout
Main View
┌──────────────────────────────────────────────────────────────────────┐
│ OpenSWE                    owner/repo     [⚠ 2 tasks]   [Opencode]  │
├────────────────────────┬─────────────────────────────────────────────┤
│ Sessions (3/5 active)  │ Preview: Fix login bug (#123)              │
│                        │ Phase: ████████░░░░ Coding                 │
│ ┌────────────────────┐ │─────────────────────────────────────────────│
│ │● Fix login bug     │ │ > [OPENSWE:PHASE:coding]                   │
│ │  #123 │ Coding     │ │ > Looking at auth/validateToken.ts...      │
│ │  2.3k tokens       │ │ > Found the bug - token expiry not checked │
│ └────────────────────┘ │ > Implementing fix...                      │
│ ┌────────────────────┐ │ > Writing test for edge case...            │
│ │○ Add dark mode     │ │ > git commit -m "fix: check token expiry"  │
│ │  #456 │ Research   │ │ >                                          │
│ │  0 tokens          │ │                                             │
│ └────────────────────┘ │                                             │
│ ┌────────────────────┐ │                                             │
│ │⚠ Refactor API      │ │                                             │
│ │  #789 │ NEEDS ATTN │ │                                             │
│ │  1.1k tokens       │ │                                             │
│ └────────────────────┘ │                                             │
│ ┌────────────────────┐ │                                             │
│ │✓ Fix typo in docs  │ │                                             │
│ │  #101 │ Completed  │ │                                             │
│ │  500 tokens        │ │                                             │
│ └────────────────────┘ │                                             │
│                        │                                             │
├────────────────────────┴─────────────────────────────────────────────┤
│ ↑↓/jk navigate │ Enter takeover │ t tasks │ n new │ i issues │ q quit│
└──────────────────────────────────────────────────────────────────────┘
Status Icons:
● active (green)     ○ queued (gray)      ⚠ needs attention (yellow)
✓ completed (green)  ✗ failed (red)       ⏸ paused (blue)
Human Task Queue Modal
┌─────────────────── Human Tasks (2) ────────────────────┐
│                                                         │
│  ⚠ HIGH   Question in "Fix login bug" (#123)           │
│           → Which auth provider should I use for       │
│             the new SSO feature?                        │
│                                                         │
│  ⚠ HIGH   Permission in "Add dark mode" (#456)         │
│           → Run `npm install styled-components`?        │
│                                                         │
│  ○ LOW    PR Ready: "Fix typo in docs" (#101)          │
│           → PR #234 created, awaiting review            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  ↑↓ navigate │ [Enter] Jump to session │ [Esc] Close   │
└─────────────────────────────────────────────────────────┘
Issue Selector Modal
┌─────────────────── Select Issues ──────────────────────┐
│  Filter: open │ Labels: all                             │
│                                                         │
│  [ ] #123  Fix login bug                               │
│            Labels: bug, auth    │ 3 days ago           │
│                                                         │
│  [✓] #456  Add dark mode toggle                        │
│            Labels: enhancement  │ 1 week ago           │
│                                                         │
│  [✓] #789  Refactor API layer                          │
│            Labels: refactor     │ 2 weeks ago          │
│                                                         │
│  [ ] #101  Update documentation                        │
│            Labels: docs         │ 1 month ago          │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [Space] Toggle  [Enter] Create sessions  [Esc] Cancel  │
└─────────────────────────────────────────────────────────┘
First-Run Wizard (Empty Directory)
┌  OpenSWE Setup
│
◇  Current directory is empty.
│
◆  Enter a GitHub repository to link:
│  owner/repo
│
●  Cloning owner/repo into current directory...
✓  Repository cloned successfully.
│
◆  Which AI backend would you like to use?
│  ● Opencode (recommended)
│  ○ Claude Code
│
◆  Maximum concurrent sessions? (default: 5)
│  5
│
◆  Automatically create draft PRs when sessions complete?
│  ● Yes (recommended)
│  ○ No
│
└  Project initialized! Starting OpenSWE...
First-Run Wizard (Existing Repo)
┌  OpenSWE Setup
│
◇  Detected existing git repository: owner/repo
│
◆  Initialize OpenSWE for this repository?
│  ● Yes, set up OpenSWE here
│  ○ No, exit
│
◆  Which AI backend would you like to use?
│  ● Opencode (recommended)  
│  ○ Claude Code
│
└  Project initialized! Starting OpenSWE...
---
Source Code Structure
openswe/
├── src/
│   ├── index.ts                   # Entry point, CLI setup with yargs
│   ├── app.tsx                    # Main Solid.js TUI application
│   │
│   ├── components/
│   │   ├── App.tsx                # Root component, layout manager
│   │   ├── SessionList.tsx        # Left pane - scrollable session list
│   │   ├── SessionCard.tsx        # Individual session card with status
│   │   ├── Preview.tsx            # Right pane - session output preview
│   │   ├── StatusBar.tsx          # Bottom bar with keybindings, task badge
│   │   ├── PhaseProgress.tsx      # SWE phase progress indicator bar
│   │   ├── TaskQueueModal.tsx     # Human task queue overlay
│   │   ├── IssueSelectorModal.tsx # Issue multi-select overlay
│   │   └── Wizard.tsx             # First-run setup wizard
│   │
│   ├── core/
│   │   ├── session.ts             # Session state machine & lifecycle
│   │   ├── pty.ts                 # PTY manager with bun-pty
│   │   ├── buffer.ts              # Circular output buffer (ring buffer)
│   │   ├── parser.ts              # Output marker parser (DONE, PHASE, etc.)
│   │   └── queue.ts               # Human task queue manager
│   │
│   ├── workspace/
│   │   ├── detect.ts              # Detect existing repo/project
│   │   ├── init.ts                # Initialize new project
│   │   └── paths.ts               # Path utilities (resolve .openswe, etc.)
│   │
│   ├── github/
│   │   ├── client.ts              # gh CLI wrapper utilities
│   │   ├── issues.ts              # Issue fetching & filtering
│   │   └── pr.ts                  # PR creation
│   │
│   ├── git/
│   │   ├── repo.ts                # Clone operations
│   │   └── worktree.ts            # Worktree create/delete/list
│   │
│   ├── store/
│   │   ├── db.ts                  # SQLite connection & migrations
│   │   ├── sessions.ts            # Session CRUD operations
│   │   ├── tasks.ts               # Human task CRUD operations
│   │   ├── project.ts             # Project metadata operations
│   │   └── schema.sql             # Database schema
│   │
│   ├── config/
│   │   ├── types.ts               # Config type definitions
│   │   ├── global.ts              # Global config loader (~/.config/openswe/)
│   │   ├── defaults.ts            # Default configuration values
│   │   └── env.ts                 # Environment variable handling
│   │
│   ├── prompts/
│   │   └── swe-system.ts          # System prompt template for AI sessions
│   │
│   └── utils/
│       ├── logger.ts              # Logging utility
│       ├── id.ts                  # UUID generation
│       └── format.ts              # Formatting helpers (tokens, dates)
│
├── package.json
├── tsconfig.json
├── bunfig.toml
└── README.md
---
CLI Interface
# Start OpenSWE in current directory
openswe
# Start with specific repo (clones if directory is empty)
openswe --repo owner/repo
openswe -r owner/repo
# Force re-run the setup wizard
openswe --setup
# Show project status without TUI (quick check)
openswe --status
# Use specific AI backend (overrides config)
openswe --backend opencode
openswe --backend claude
# Set max concurrent sessions (overrides config)  
openswe --max-sessions 3
# Show help
openswe --help
openswe -h
# Show version
openswe --version
openswe -v
---
Keybindings (Default)
| Key | Action |
|-----|--------|
| j / ↓ | Navigate down in list |
| k / ↑ | Navigate up in list |
| Enter | Enter/takeover selected session |
| Esc | Exit session / close modal |
| n | Create new manual session |
| i | Open issue selector |
| t | Open human task queue |
| d | Delete selected session (with confirmation) |
| p | Pause/resume selected session |
| r | Refresh (re-fetch issues) |
| ? | Show help overlay |
| q | Quit OpenSWE |
---
Feature Summary
| Feature | MVP | Post-MVP |
|---------|:---:|:--------:|
| Project-local workspace model | ✓ | |
| TUI shell (2-pane layout) | ✓ | |
| Session list with status indicators | ✓ | |
| Preview pane with output | ✓ | |
| Keyboard navigation (vim-style) | ✓ | |
| First-run wizard | ✓ | |
| Global configuration system (TOML) | ✓ | |
| GitHub issue fetching | ✓ | |
| Issue selector modal | ✓ | |
| Git worktree management | ✓ | |
| Human task queue modal | ✓ | |
| SQLite persistence | ✓ | |
| SWE phase display | ✓ | |
| PTY session management | | ✓ |
| Full session takeover | | ✓ |
| Opencode integration | | ✓ |
| Output marker parsing | | ✓ |
| Auto-retry (2x) | | ✓ |
| Auto PR creation | | ✓ |
| Session persistence (restart recovery) | | ✓ |
| Claude Code integration | | ✓ |
---
Implementation Phases
Phase 1: Project Bootstrap
- [ ] Initialize Bun project with TypeScript
- [ ] Configure tsconfig.json for Solid.js JSX
- [ ] Install core dependencies:
  - @opentui/core, @opentui/solid
  - yargs
  - @clack/prompts
  - @iarna/toml
- [ ] Create source directory structure
- [ ] Set up basic CLI entry point with yargs
- [ ] Implement logger utility
Phase 2: Configuration System
- [ ] Define config types (types.ts)
- [ ] Implement defaults (defaults.ts)
- [ ] Implement global config loader (~/.config/openswe/config.toml)
- [ ] Environment variable overrides (OPENSWE_*)
- [ ] CLI flag overrides
Phase 3: Workspace Detection & Initialization
- [ ] Implement workspace detection (detect.ts)
  - Check for .openswe/ (existing project)
  - Check for .git/ (existing repo)
  - Handle empty directory
- [ ] Implement project initialization (init.ts)
- [ ] Path utilities (paths.ts)
Phase 4: First-Run Wizard
- [ ] Implement wizard with @clack/prompts (Wizard.tsx)
  - Repo input (for empty dir)
  - AI backend selection
  - Max sessions setting
  - Auto PR preference
- [ ] Clone repo if needed
- [ ] Create .openswe/ directory
- [ ] Save global config on first run
Phase 5: Database Layer
- [ ] Set up SQLite with bun:sqlite (db.ts)
- [ ] Implement schema and migrations
- [ ] Create project.ts (project metadata CRUD)
- [ ] Create sessions.ts (session CRUD)
- [ ] Create tasks.ts (human task CRUD)
Phase 6: TUI Shell - Layout
- [ ] Create main App component (App.tsx)
- [ ] Implement 2-pane flex layout
- [ ] Create SessionList component (left pane)
- [ ] Create SessionCard component
- [ ] Create Preview component (right pane)
- [ ] Create StatusBar component
- [ ] Create PhaseProgress component
Phase 7: TUI Shell - Interactivity
- [ ] Implement keyboard event handling
- [ ] Navigation (j/k/↑/↓)
- [ ] Session selection state
- [ ] Status indicators (●○⚠✓✗⏸)
- [ ] Wire SessionList to database
- [ ] Live preview updates on selection
Phase 8: GitHub Integration
- [ ] Implement gh CLI wrapper (client.ts)
- [ ] Check gh auth status on startup
- [ ] Implement issue fetching (issues.ts)
- [ ] Issue filtering (state, labels)
- [ ] Create IssueSelectorModal component
- [ ] Wire 'i' key to open modal
- [ ] Create sessions from selected issues
Phase 9: Git Worktree Management
- [ ] Implement repo operations (repo.ts)
  - Clone to current directory
  - Get remote URL
- [ ] Implement worktree operations (worktree.ts)
  - Create: git worktree add .worktrees/{name} -b openswe/{branch}
  - List: git worktree list
  - Remove: git worktree remove
- [ ] Add .worktrees/ to .gitignore automatically
- [ ] Worktree cleanup on session delete
Phase 10: Human Task Queue
- [ ] Create TaskQueueModal component
- [ ] Add badge counter to StatusBar
- [ ] Wire 't' key to open modal
- [ ] Priority sorting (high → medium → low)
- [ ] Jump-to-session on selection
- [ ] Mark task resolved when session continues
Phase 11: PTY & Session Management (Post-MVP)
- [ ] Install bun-pty
- [ ] Implement PTY manager (pty.ts)
- [ ] Spawn process in worktree directory
- [ ] Create output ring buffer (buffer.ts)
- [ ] Stream output to Preview pane
- [ ] Implement full takeover mode (Enter on session)
- [ ] Handle stdin forwarding in takeover
- [ ] Handle session exit/cleanup
- [ ] Update session status on exit
Phase 12: AI Integration - Opencode (Post-MVP)
- [ ] Spawn Opencode process in worktree
- [ ] Inject SWE system prompt (--prompt flag or stdin)
- [ ] Implement output parser (parser.ts)
- [ ] Detect OPENSWE:PHASE:* → update session.phase
- [ ] Detect OPENSWE:BLOCKER:* → create HumanTask
- [ ] Detect OPENSWE:DONE → mark session complete
- [ ] Detect question/permission patterns → create HumanTask
- [ ] Implement auto-retry logic (max 2 retries)
Phase 13: PR Automation (Post-MVP)
- [ ] Detect OPENSWE:DONE marker
- [ ] Verify branch has commits ahead of main
- [ ] Push branch to remote
- [ ] Create PR via gh pr create (pr.ts)
- [ ] Apply PR title/body templates
- [ ] Update session.prUrl
- [ ] Create "PR ready for review" HumanTask
Phase 14: Session Persistence & Recovery (Post-MVP)
- [ ] Save session state on every status change
- [ ] Persist output buffer snapshots periodically
- [ ] On startup: check for sessions with PIDs
- [ ] Verify if process still running (kill -0)
- [ ] Attempt PTY reattach for running processes
- [ ] Mark orphaned sessions as "interrupted"
- [ ] Offer restart option for interrupted sessions
Phase 15: Claude Code Support (Post-MVP)
- [ ] Abstract AI backend interface
- [ ] Implement Claude Code spawner
- [ ] Handle Claude-specific output patterns
- [ ] Test both backends
- [ ] Backend switching in config
Phase 16: Polish & Hardening
- [ ] Comprehensive error handling
- [ ] User-friendly error messages
- [ ] Edge case handling
  - No network
  - gh not installed
  - Git not installed
  - Rate limits
- [ ] Help overlay ('?' key)
- [ ] Performance optimization
- [ ] README documentation
---
Dependencies
{
  name: openswe,
  type: module,
  version: 0.1.0,
  bin: {
    openswe: ./dist/index.js
  },
  scripts: {
    dev: bun run src/index.ts,
    build: bun build src/index.ts --outdir dist --target node,
    test: bun test
  },
  dependencies: {
    @opentui/core: ^0.x,
    @opentui/solid: ^0.x,
    @iarna/toml: ^2.x,
    yargs: ^17.x,
    @clack/prompts: ^0.x,
    uuid: ^9.x
  },
  devDependencies: {
    @types/bun: latest,
    @types/yargs: ^17.x,
    typescript: ^5.x
  },
  peerDependencies: {
    bun-pty: ^0.x
  }
}
Note: bun-pty is a peer dependency since it's only needed for post-MVP phases.
---
Risks & Mitigations
| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| OpenTUI breaking changes | High | Medium | Pin version, test upgrades carefully |
| OpenTUI documentation gaps | Medium | Medium | Study Opencode source for patterns |
| bun-pty compatibility issues | Medium | Low | Fallback to node-pty if needed |
| gh CLI not installed | Medium | Medium | Check on startup, provide installation guide |
| Git not installed | High | Low | Check on startup, error early |
| AI output format varies | Medium | Medium | Flexible regex, fallback heuristics |
| Git worktree edge cases | Low | Medium | Thorough testing, cleanup on error |
| Rate limits (GitHub/AI) | Medium | Medium | Exponential backoff, queue management |
| Large repos slow to clone | Low | Medium | Show progress, allow cancel |
---
Testing Strategy
Unit Tests
- Config loading and merging
- Session state machine transitions
- Output parser (marker detection)
- Worktree path generation
- Buffer operations
Integration Tests
- Workspace detection (all 3 scenarios)
- Database operations (CRUD)
- Git operations (clone, worktree create/delete)
- gh CLI wrapper (mock responses)
Manual Testing
- Fresh directory → full wizard flow
- Existing repo → adopt flow
- Existing project → resume flow
- Session lifecycle (create → active → complete)
- Human task creation and resolution
- Full session takeover
---
Success Criteria
MVP (v0.1)
- [ ] Can run openswe in empty dir, clone repo, see TUI
- [ ] Can run openswe in existing repo, adopt it
- [ ] Can fetch and display issues from GitHub
- [ ] Can create sessions from selected issues
- [ ] Sessions have isolated worktrees
- [ ] Can see session list with status indicators
- [ ] Human task queue tracks attention needs
- [ ] Can navigate with keyboard (vim-style)
v0.2 (Post-MVP)
- [ ] Can spawn Opencode in session worktree
- [ ] Can see live output in preview pane
- [ ] Can take over session and interact directly
- [ ] Phase progress updates automatically
- [ ] PRs created automatically on completion
- [ ] Sessions survive app restart
v1.0
- [ ] Both Opencode and Claude Code supported
- [ ] Robust error handling
- [ ] Polished UX
- [ ] Documentation complete
---
Next Steps
Ready to begin implementation? Phase 1 (Project Bootstrap) involves:
1. bun init in the openswe directory
2. Configure TypeScript for Solid.js
3. Install core dependencies
4. Create the directory structure
5. Set up basic CLI entry point
