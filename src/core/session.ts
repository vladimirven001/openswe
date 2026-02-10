/**
 * Session lifecycle manager (Tmux Backend)
 *
 * Coordinates Tmux sessions, output parsing, and state transitions.
 * Handles session completion.
 */

import {
  getSession,
  getSessionsByStatus,
  updateSessionStatus,
  updateSessionPhase,
  incrementRetryCount,
  setPid,
  setAISessionData,
  setLines,
  getAllLines,
  isValidPhase,
  getProject,
  resetSessionForReload,
} from "../store"
import type { AISessionData } from "../store"
import type { GlobalConfig, AIBackend } from "../config"
import { createParser } from "./parser"
import type { ParsedEvent } from "./parser"
import { TmuxManager } from "./tmux"
import { logger } from "../utils/logger"
import { getSessionLogPath } from "../workspace/paths"
import { dirname } from "path"
import { existsSync } from "fs"
import { mkdir, open } from "fs/promises"
import { getProvider } from "../providers"
import type { Provider } from "../providers"
import { createWorktree } from "../git"
import { generateSWEPrompt } from "../prompts"

export interface StartSessionOptions {
  sessionId: string
  prompt?: string
  resumeSessionId?: string
  aiSessionData?: AISessionData | null
}

interface ActiveSession {
  stopTail: () => void
  logPath: string
}

export class SessionManager {
  private config: GlobalConfig
  private processManager: TmuxManager
  private activeSessions: Map<string, ActiveSession>
  private projectRoot: string
  private provider: Provider
  private parseOutputLine: (line: string) => ParsedEvent | null

  private static readonly ANSI_ESCAPE_REGEX = /\x1b\[[0-9;]*[A-Za-z]/g
  private static readonly ANSI_OSC_REGEX = /\x1b\][^\x07]*(?:\x07|\x1b\\)/g

  constructor(
    config: GlobalConfig,
    projectRoot: string,
    processManager?: TmuxManager
  ) {
    this.config = config
    this.projectRoot = projectRoot
    this.processManager = processManager ?? new TmuxManager()
    this.activeSessions = new Map()

    // Initialize provider based on config
    this.provider = getProvider(config.ai.backend)
    this.parseOutputLine = createParser(this.provider.parserPatterns)

    // Start background poller for session health/exit detection
    setInterval(() => this.checkSessionHealth(), 2000)
  }

  /**
   * Get the current AI provider
   */
  getProvider(): Provider {
    return this.provider
  }

  /**
   * Switch to a different AI provider at runtime
   * @param backend - The backend to switch to
   */
  setProvider(backend: AIBackend): void {
    this.provider = getProvider(backend)
    this.parseOutputLine = createParser(this.provider.parserPatterns)
    this.config.ai.backend = backend
  }

  /**
   * Recover sessions that were active/running
   *
   * Handles edge cases:
   * - Sessions marked "active" in DB but not in tmux → mark as "paused"
   * - Tmux sessions running but session marked "paused" → re-mark as "active"
   * - Log orphaned tmux sessions for manual cleanup
   */
  async recoverSessions(): Promise<void> {
    const activeIds = await this.processManager.listActiveSessions()
    const dbActiveSessions = getSessionsByStatus("active")
    const dbPausedSessions = getSessionsByStatus("paused")

    // Track which tmux sessions we've matched to DB sessions
    const matchedTmuxIds = new Set<string>()

    // 1. Handle sessions marked "active" in DB
    for (const session of dbActiveSessions) {
      if (activeIds.includes(session.id)) {
        // DB active + tmux running → recover (attach log tail)
        logger.info(`Recovering active session "${session.name}" (found in tmux)`)
        await this.attachLogTail(session.id)
        matchedTmuxIds.add(session.id)
      } else {
        // DB active + tmux not running → crashed/finished while app was closed
        logger.warn(`Session "${session.name}" marked active but not found in tmux. Marking as paused.`)
        updateSessionStatus(session.id, "paused")
        setPid(session.id, null)
      }
    }

    // 2. Handle sessions marked "paused" in DB but still running in tmux
    for (const session of dbPausedSessions) {
      if (activeIds.includes(session.id)) {
        // DB paused + tmux running → re-activate
        logger.info(`Session "${session.name}" found running in tmux (was marked paused). Re-activating.`)
        updateSessionStatus(session.id, "active")
        await this.attachLogTail(session.id)
        matchedTmuxIds.add(session.id)
      }
    }

    // 3. Log orphaned tmux sessions (running in tmux but no matching DB session)
    for (const tmuxId of activeIds) {
      if (!matchedTmuxIds.has(tmuxId)) {
        const session = getSession(tmuxId)
        if (!session) {
          logger.warn(`Orphaned tmux session found: openswe-${tmuxId} (no DB record). Consider killing it manually with: tmux kill-session -t openswe-${tmuxId}`)
        }
      }
    }
  }

  /**
   * Check if active sessions are still running
   */
  private async checkSessionHealth() {
    for (const [sessionId, sessionData] of this.activeSessions) {
      const isRunning = await this.processManager.isRunning(sessionId)
      if (!isRunning) {
        // Process exited!
        this.handleExit(sessionId)
      }
    }
  }

  async startSession(options: StartSessionOptions): Promise<void> {
    const session = getSession(options.sessionId)
    if (!session) {
      throw new Error(`Session not found: ${options.sessionId}`)
    }

    try {
      updateSessionStatus(session.id, "active")

      // Auto-transition phase: planning if prompt-driven, working if interactive
      updateSessionPhase(session.id, options.prompt ? "planning" : "working")

      if (options.aiSessionData !== undefined) {
        setAISessionData(session.id, options.aiSessionData)
      }

      const logPath = getSessionLogPath(this.projectRoot, session.id)
      await this.ensureLogFile(logPath)

      // Use session's backend if available, otherwise fall back to global config
      const backend = options.aiSessionData?.backend ?? session.aiSessionData?.backend ?? this.config.ai.backend
      const provider = getProvider(backend)

      // Ensure Claude can use a deterministic session ID when starting new sessions
      let effectiveSession = session
      if (options.aiSessionData) {
        effectiveSession = { ...session, aiSessionData: options.aiSessionData }
      }

      if (backend === "claude" && !options.resumeSessionId) {
        const currentData = options.aiSessionData ?? session.aiSessionData
        if (!currentData?.sessionId) {
          const newData = {
            backend,
            sessionId: session.id,
          }
          setAISessionData(session.id, newData)
          effectiveSession = { ...session, aiSessionData: newData }
        } else if (!options.aiSessionData) {
          effectiveSession = { ...session, aiSessionData: currentData }
        }
      } else if (!options.aiSessionData && session.aiSessionData) {
        effectiveSession = { ...session, aiSessionData: session.aiSessionData }
      }

      // Build spawn command using the session's provider
      // Provider uses its own default model - no model configuration needed
      const spawnCmd = provider.buildSpawnCommand(
        effectiveSession,
        options.prompt,
        options.resumeSessionId
      )

      // Filter env to remove undefined values
      const baseEnv = Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v !== undefined)
      ) as Record<string, string>

      // Merge provider-specific env vars
      const env = { ...baseEnv, ...spawnCmd.env }

      // Validate that the worktree directory exists before spawning.
      // If it's missing (e.g., deleted externally, git worktree prune), attempt
      // to recreate it so tmux doesn't silently fall back to $HOME.
      if (!existsSync(session.worktreePath)) {
        logger.warn(`Worktree missing for session "${session.name}": ${session.worktreePath}. Attempting to recreate.`)

        // Derive the worktree name from the stored path (last segment)
        const pathParts = session.worktreePath.split("/")
        const worktreeName = pathParts[pathParts.length - 1]

        if (!worktreeName) {
          throw new Error(`Cannot recreate worktree: invalid worktree path "${session.worktreePath}"`)
        }

        const worktreeResult = await createWorktree(this.projectRoot, worktreeName)
        if (!worktreeResult.success) {
          updateSessionStatus(session.id, "needs_attention")
          throw new Error(`Worktree directory missing and recreation failed: ${worktreeResult.error}`)
        }

        logger.info(`Worktree recreated for session "${session.name}" at ${session.worktreePath}`)
      }

      // Spawn tmux session
      const pid = await this.processManager.spawn(
        session.id,
        spawnCmd.command,
        spawnCmd.args,
        session.worktreePath,
        env,
        logPath
      )

      setPid(session.id, pid)

      // Start tailing logs for parsing
      await this.attachLogTail(session.id)

    } catch (error) {
      updateSessionStatus(session.id, "failed")
      logger.error(`Failed to start session ${session.id}:`, error)
      throw error
    }
  }

  private async attachLogTail(sessionId: string): Promise<void> {
    const logPath = getSessionLogPath(this.projectRoot, sessionId)
    await this.ensureLogFile(logPath)

    // Use tail -f to stream logs
    const tailProc = Bun.spawn(["tail", "-f", "-n", "+1", logPath], {
      stdout: "pipe",
      stderr: "pipe"
    })

    // Consume stream
    const reader = tailProc.stdout.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    const readLoop = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          
          // Process all complete lines
          buffer = lines.pop() || "" // Keep last incomplete line
          
          for (const line of lines) {
            this.handleOutputLine(sessionId, line)
          }
        }
      } catch (e) {
        // Tail killed
      }
    }

    readLoop()

    const errorReader = tailProc.stderr.getReader()
    const handleError = async () => {
      try {
        const { value } = await errorReader.read()
        if (value) {
          const msg = new TextDecoder().decode(value)
          if (msg.trim()) {
            logger.warn(`Log tail error for ${sessionId}: ${msg.trim()}`)
          }
        }
      } catch {
        // Ignore tail stderr errors
      }
    }

    handleError()

    this.activeSessions.set(sessionId, {
      logPath,
      stopTail: () => {
        tailProc.kill()
      }
    })
  }

  async pauseSession(sessionId: string): Promise<void> {
    // Capture final state before killing
    try {
      const lines = await this.getSnapshot(sessionId)
      logger.debug(`Captured final snapshot for ${sessionId}: ${lines.length} lines`)
    } catch (e) {
      logger.warn(`Failed to capture final snapshot for ${sessionId}:`, e)
    }

    await this.processManager.kill(sessionId)
    this.cleanupSession(sessionId)
    updateSessionStatus(sessionId, "paused")
    setPid(sessionId, null)
  }

  async stopSession(sessionId: string): Promise<void> {
    await this.processManager.kill(sessionId)
    this.cleanupSession(sessionId)
    updateSessionStatus(sessionId, "queued")
    setPid(sessionId, null)
  }

  /**
   * Reload a session - stop it and restart with preserved AI session data
   *
   * This closes the current session and restarts it using the same AI provider
   * and session ID, allowing the conversation to continue from where it left off.
   *
   * @param sessionId - The session to reload
   */
  async reloadSession(sessionId: string): Promise<void> {
    const session = getSession(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    logger.info(`Reloading session "${session.name}" (${sessionId})`)

    // 1. Stop existing session if running
    if (this.activeSessions.has(sessionId)) {
      await this.stopSession(sessionId)
    }

    // 2. Reset session state in DB (clear output buffer, reset phase/status)
    resetSessionForReload(sessionId)

    // 3. Restart with preserved aiSessionData
    await this.startSession({
      sessionId: session.id,
      prompt: session.issueNumber ? generateSWEPrompt(session) : undefined,
      resumeSessionId: session.aiSessionData?.sessionId,
      aiSessionData: session.aiSessionData,
    })

    logger.info(`Session "${session.name}" reloaded successfully`)
  }

  /**
   * Get the current visual state of the session for preview
   */
  async getSnapshot(sessionId: string): Promise<string[]> {
    try {
      const snapshot = await this.processManager.getSnapshot(sessionId)
      // Save to DB for persistence/caching
      // If snapshot is empty, do we want to overwrite DB with empty?
      // Yes, if tmux is cleared.
      setLines(sessionId, snapshot.lines)
      return snapshot.lines
    } catch {
      // If session not running or error, return cached lines from DB
      return getAllLines(sessionId)
    }
  }

  /**
   * Get command to attach to this session
   */
  getAttachCommand(sessionId: string): string[] {
    return this.processManager.getAttachCommand(sessionId)
  }

  /**
   * Resize the session terminal
   */
  async resizeSession(sessionId: string, cols: number, rows: number): Promise<void> {
    await this.processManager.resize(sessionId, cols, rows)
  }

  /**
   * Set the window title for the session
   */
  async setWindowTitle(sessionId: string, title: string): Promise<void> {
    await this.processManager.setWindowTitle(sessionId, title)
  }

  private cleanupSession(sessionId: string) {
    const active = this.activeSessions.get(sessionId)
    if (active) {
      active.stopTail()
      this.activeSessions.delete(sessionId)
    }
  }

  private handleOutputLine(sessionId: string, line: string): void {
    const normalizedLine = this.normalizeOutputLine(line)

    // Parse protocol events for state management using provider-specific patterns
    const event = this.parseOutputLine(normalizedLine)
    if (!event) return

    switch (event.type) {
      case "working":
        updateSessionPhase(sessionId, "working")
        break
      case "session_id":
        if (event.payload) {
          const currentSession = getSession(sessionId)
          // Default to current provider backend if not set
          const backend = currentSession?.aiSessionData?.backend ?? this.provider.id
          
          const newData = {
            backend,
            ...(currentSession?.aiSessionData || {}),
            sessionId: event.payload,
          }
          
          setAISessionData(sessionId, newData)
          logger.debug(`Captured session ID for ${sessionId}: ${event.payload}`)
        }
        break
      case "done":
        updateSessionPhase(sessionId, "completed")
        this.handleSessionCompletion(sessionId).catch((err) => {
          logger.error(`Session completion handler failed for ${sessionId}:`, err)
        })
        break
    }
  }

  private normalizeOutputLine(line: string): string {
    return line
      .replace(SessionManager.ANSI_OSC_REGEX, "")
      .replace(SessionManager.ANSI_ESCAPE_REGEX, "")
      .replace(/\r/g, "")
  }

  private async ensureLogFile(logPath: string): Promise<void> {
    const logDir = dirname(logPath)
    try {
      await mkdir(logDir, { recursive: true })
      const handle = await open(logPath, "a")
      await handle.close()
    } catch (error) {
      logger.warn(`Failed to initialize log file ${logPath}:`, error)
    }
  }

  private async handleSessionCompletion(sessionId: string): Promise<void> {
    const session = getSession(sessionId)
    if (!session) return

    this.completeSession(sessionId)
    logger.info(`Session ${session.name} completed`)
  }

  private completeSession(sessionId: string) {
    updateSessionPhase(sessionId, "completed")
    updateSessionStatus(sessionId, "completed")
    setPid(sessionId, null)
    // We don't necessarily kill the tmux session immediately? 
    // Or do we? If it's done, opencode process likely exited.
    // If not, we should probably leave it for user to inspect until they delete?
    // Let's leave it running if it's still there (e.g. if opencode waits for keypress at end)
    // But usually we want to free resources.
    // For now: Leave it. `handleExit` will clean it up if process exits.
  }

  private handleExit(sessionId: string): void {
    this.cleanupSession(sessionId)
    
    const session = getSession(sessionId)
    if (!session) return

    if (session.status === "completed" || session.status === "failed") {
      setPid(sessionId, null)
      return
    }

    // Determine if it was a success or failure exit?
    // We don't have exit code from polling. 
    // But if we didn't get [OPENSWE:DONE], it's likely a crash or manual exit.
    
    // Check if phase is completed
    if (session.phase === "completed") {
      updateSessionStatus(sessionId, "completed")
    } else {
      const retryCount = incrementRetryCount(sessionId)
      if (retryCount >= 2) {
        updateSessionStatus(sessionId, "failed")
      } else {
        // Auto-restart? Or just queue?
        // Logic says "queued" to retry.
        updateSessionStatus(sessionId, "queued")
      }
    }
    setPid(sessionId, null)
  }
}
