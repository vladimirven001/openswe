/**
 * Tmux Process Manager
 * 
 * Manages sessions using tmux.
 * - Sessions are named "openswe-<id>"
 * - Output is piped to a log file for parsing
 * - Visual state is retrieved via capture-pane
 */

import { existsSync } from "fs"
import type { ProcessManager, ProcessSnapshot } from "./process-manager"
import { logger } from "../utils/logger"
import { shellQuote } from "../utils/shell"

export class TmuxManager implements ProcessManager {
  private prefix = "openswe-"
  private serverInitialized = false

  /**
   * Ensure tmux server is running before any operations
   */
  private async ensureServer(): Promise<void> {
    if (this.serverInitialized) return

    const proc = Bun.spawn(["tmux", "start-server"], {
      stderr: "pipe",
      stdout: "ignore"
    })
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      const err = await new Response(proc.stderr).text()
      throw new Error(`Failed to start tmux server: ${err}`)
    }

    this.serverInitialized = true
  }

  private getSessionName(id: string): string {
    return `${this.prefix}${id}`
  }

  private getIdFromSessionName(name: string): string | null {
    if (name.startsWith(this.prefix)) {
      return name.slice(this.prefix.length)
    }
    return null
  }

  async spawn(id: string, command: string, args: string[], cwd: string, env: Record<string, string>, logPath: string): Promise<number> {
    await this.ensureServer()

    const sessionName = this.getSessionName(id)

    // Construct the command string safely
    // We use 'script' or simple pipe to capture output while keeping it interactive-ish
    // But opencode is a TUI, so we just want to run it.
    // To capture output for the parser, we use 'pipe' but we also need the TUI to work in tmux.
    // The trick: tmux runs the command. We don't strictly need to pipe purely for the parser if we rely on capture-pane,
    // BUT the parser needs the hidden markers [OPENSWE:...] which might be scrolled off screen.
    // So we DO need to pipe stdout.
    
    // Using `tee` might buffer or mess up TUI.
    // Better approach: Let tmux handle the TUI.
    // For parsing markers: We can use `tmux pipe-pane` to stream output to a file!
    
    // Validate that cwd exists on disk -- tmux silently falls back to $HOME
    // when given a non-existent -c path, which causes sessions to spawn from ~
    if (!existsSync(cwd)) {
      throw new Error(`Working directory does not exist: ${cwd}. The worktree may have been deleted.`)
    }

    const fullCommand = `${shellQuote(command)} ${args.map(shellQuote).join(" ")}`
    
    // 1. Create detached session
    // -d: detached
    // -s: session name
    // -c: working directory
    // -x: width (default 80 is too small for modern screens)
    // -y: height (default 24 is too small)
    const createProc = Bun.spawn([
      "tmux", "new-session", 
      "-d", 
      "-s", sessionName, 
      "-x", "140",
      "-y", "50",
      "-c", cwd,
      // We start with a shell to ensure env vars are loaded if needed, or just run the command
      fullCommand
    ], {
      env: { ...process.env, ...env },
      stderr: "pipe"
    })

    const createExit = await createProc.exited
    if (createExit !== 0) {
      const err = await new Response(createProc.stderr).text()
      throw new Error(`Failed to create tmux session: ${err}`)
    }

    // 2. Enable logging (pipe-pane) to capture stream for parser
    // This logs everything printed to the pane to a file
    // Escape the logPath for shell safety (single quotes, escape internal single quotes)
    const escapedLogPath = logPath.replace(/'/g, "'\\''")
    const pipeProc = Bun.spawn([
      "tmux", "pipe-pane",
      "-t", sessionName,
      `cat >> '${escapedLogPath}'`  // Use append mode and single quotes for safety
    ], { stderr: "pipe" })

    const pipeExit = await pipeProc.exited
    if (pipeExit !== 0) {
      const err = await new Response(pipeProc.stderr).text()
      logger.warn(`pipe-pane setup failed for ${sessionName}: ${err}`)
    }

    // 2.5 Disable status bar to reclaim vertical space
    await Bun.spawn(["tmux", "set-option", "-t", sessionName, "status", "off"], { stderr: "ignore" }).exited

    // 3. Get PID of the process inside tmux (approximate)
    // tmux list-panes -t session -F "#{pane_pid}"
    const pidProc = Bun.spawn(["tmux", "list-panes", "-t", sessionName, "-F", "#{pane_pid}"], { stdout: "pipe" })
    const pidStr = await new Response(pidProc.stdout).text()
    return parseInt(pidStr.trim(), 10)
  }

  async isRunning(id: string): Promise<boolean> {
    await this.ensureServer()

    const sessionName = this.getSessionName(id)
    const proc = Bun.spawn(["tmux", "has-session", "-t", sessionName], { stderr: "ignore" })
    const exitCode = await proc.exited
    return exitCode === 0
  }

  async kill(id: string): Promise<void> {
    const sessionName = this.getSessionName(id)
    // Kill the session
    const proc = Bun.spawn(["tmux", "kill-session", "-t", sessionName], { stderr: "ignore" })
    await proc.exited
  }

  async getSnapshot(id: string): Promise<ProcessSnapshot> {
    await this.ensureServer()

    // Verify session exists first to avoid capture-pane errors
    if (!(await this.isRunning(id))) {
      return { lines: [], cursor: null }
    }

    const sessionName = this.getSessionName(id)

    // capture-pane -p (print) -e (include escape sequences for colored preview)
    // The Preview component uses ansi-parser to render colored output

    const proc = Bun.spawn(["tmux", "capture-pane", "-pet", sessionName], { stdout: "pipe", stderr: "pipe" })
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      logger.warn(`capture-pane failed for ${sessionName}`)
      return { lines: [], cursor: null }
    }

    const output = await new Response(proc.stdout).text()

    // Get lines
    const lines = output.split("\n")
    // Note: We used to trim trailing empty lines here, but that causes the
    // preview to look "short" when the terminal has empty space at the bottom.
    // We now preserve all lines to show the full terminal height.

    return {
      lines,
      cursor: null // TODO: Could get cursor pos via tmux display-message
    }
  }

  async sendInput(id: string, data: string): Promise<void> {
    const sessionName = this.getSessionName(id)
    // send-keys is mainly for strings. For control chars it's trickier.
    // simpler approach: just send keys.
    await Bun.spawn(["tmux", "send-keys", "-t", sessionName, data]).exited
  }

  async listActiveSessions(): Promise<string[]> {
    try {
      await this.ensureServer()

      // List sessions with format: name
      const proc = Bun.spawn(["tmux", "list-sessions", "-F", "#{session_name}"], { stdout: "pipe", stderr: "ignore" })
      const output = await new Response(proc.stdout).text()

      const ids: string[] = []
      for (const line of output.split("\n")) {
        const id = this.getIdFromSessionName(line.trim())
        if (id) ids.push(id)
      }
      return ids
    } catch {
      return []
    }
  }

  getAttachCommand(id: string): string[] {
    return ["tmux", "attach-session", "-t", this.getSessionName(id)]
  }

  async resize(id: string, cols: number, rows: number): Promise<void> {
    const sessionName = this.getSessionName(id)
    // resize-window sets the size of the window (and thus the detached session)
    await Bun.spawn(["tmux", "resize-window", "-t", sessionName, "-x", cols.toString(), "-y", rows.toString()], { stderr: "ignore" }).exited
  }

  async setWindowTitle(id: string, title: string): Promise<void> {
    const sessionName = this.getSessionName(id)
    // Disable automatic window renaming
    await Bun.spawn([
      "tmux", "set-option", "-t", sessionName,
      "automatic-rename", "off"
    ], { stderr: "ignore" }).exited

    // Set the window title
    await Bun.spawn([
      "tmux", "rename-window", "-t", sessionName, title
    ], { stderr: "ignore" }).exited
  }
}
