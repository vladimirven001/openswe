# openswe

openswe is an AI coding agent (opencode, claude code) orchestration tool. It connects to github, fetches open issues, and starts working on them for you.

## Requirements

- Bun (runtime)
- Zig (required to build OpenTUI native dependency)
- tmux (session management)
- Git
- GitHub CLI (`gh`) with an authenticated account
- macOS or Linux (TUI dependencies assume a POSIX environment)

## Install

```bash
git clone <repo-url>
cd openswe
bun install
```

## Installation as Command

To run `openswe` from anywhere in your terminal:

### Option 1: Development Link (Recommended for contributors)

This links the current project directory so changes are reflected immediately.

```bash
cd openswe
chmod +x src/index.ts
bun link
```

You can now run `openswe` from any directory.

### Option 2: Standalone Binary (Compiled)

To create a single executable file that can be moved anywhere (even to machines without Bun installed):

```bash
bun build ./src/index.ts --compile --outfile openswe
mv openswe /usr/local/bin/
```

### Option 3: Manual Linking

If you prefer to manually link the script:

```bash
chmod +x src/index.ts
ln -s $(pwd)/src/index.ts /usr/local/bin/openswe
```

### Option 4: Bun Global Install

You can install it globally from the local folder:

```bash
bun add -g .
```

## Quick Start

```bash
bun run dev
```

If you want to run directly without the dev script:

```bash
bun src/index.ts
```

## CLI Usage

Run `openswe` with the following options:

```bash
bun src/index.ts [options]
```

Options:

- `--repo`, `-r`: GitHub repo in `owner/repo` format (used in setup wizard)
- `--setup`: Force re-run the setup wizard
- `--status`: Show project status without launching the TUI
- `--backend`: AI backend (`opencode` or `claude`)
- `--max-sessions`: Maximum concurrent sessions
- `--debug`: Enable debug logging

Examples:

```bash
bun src/index.ts --repo owner/repo
bun src/index.ts --status
bun src/index.ts --backend opencode --max-sessions 3
```

## Configuration

OpenSWE supports configuration via CLI flags, environment variables, and a global config file. Precedence is:

1. CLI flags (highest)
2. Environment variables
3. Global config file: `~/.config/openswe/config.toml`
4. Built-in defaults (lowest)

### Environment Variables

- `OPENSWE_BACKEND`: `opencode` or `claude`
- `OPENSWE_MAX_SESSIONS`: positive integer
- `OPENSWE_LOG_LEVEL`: `debug`, `info`, `warn`, or `error`
- `OPENSWE_PR_AUTO_CREATE`: `true` or `false`
- `OPENSWE_PR_DRAFT`: `true` or `false`

## Workspace Behavior

OpenSWE detects the working directory and chooses a setup path:

1. `.openswe/` exists: load existing project
2. `.git/` exists: offer to adopt the repo
3. `--repo` flag: clone into current directory
4. Empty directory: run setup wizard

Sessions run inside Git worktrees under `.worktrees/{issue-number}/` and project state lives in `.openswe/state.db`.

## Scripts

```bash
bun run dev          # Run the CLI in development mode
bun run build        # Build to dist/
bun test             # Run all tests
bunx tsc --noEmit    # Type check (required after each iteration)
```

## Project Structure

```text
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

## Build Output

The build outputs a Bun-targeted bundle in `dist/`:

```bash
bun run build
```

## Troubleshooting

- If `@opentui/core` fails to install/build, verify Zig is installed and available in `PATH`.
- If setup fails, confirm `gh auth status` shows an authenticated GitHub account.
