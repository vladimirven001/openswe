/**
 * Session lifecycle manager (Tmux Backend)
 *
 * Coordinates Tmux sessions, output parsing, and state transitions.
 * Handles PR automation when sessions complete.
 */

import {
  getSession,
  getSessionsByStatus,
  updateSessionStatus,
  updateSessionPhase,
  incrementRetryCount,
  setPid,
  setPrUrl,
  setAISessionData,
  setLines,
  isValidPhase,
  getProject,
} from "../store"
import { addActivity } from "../store/activities"
import type { AISessionData } from "../store"
import type { GlobalConfig } from "../config"
import { parseOutputLine } from "./parser"
import { parseActivityFromLine } from "./activity-parser"
import { TmuxManager } from "./tmux"
import { TaskQueueManager } from "./queue"
import { pushBranch, getCommitsAhead, getDefaultBranch } from "../git"
import { createPR, getExistingPR } from "../github"
import { logger } from "../utils/logger"
import { getSessionLogPath } from "../workspace/paths"
import { dirname } from "path"
import { mkdir, open } from "fs/promises"

export interface StartSessionOptions {
  sessionId: string
  prompt: string
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
  private taskQueue: TaskQueueManager
  private activeSessions: Map<string, ActiveSession>
  private projectRoot: string

  private static readonly ANSI_ESCAPE_REGEX = /\x1b\[[0-9;]*[A-Za-z]/g
  private static readonly ANSI_OSC_REGEX = /\x1b\][^\x07]*(?:\x07|\x1b\\)/g

  constructor(
    config: GlobalConfig,
    projectRoot: string,
    processManager?: TmuxManager,
    taskQueue?: TaskQueueManager
  ) {
    this.config = config
    this.projectRoot = projectRoot
    this.processManager = processManager ?? new TmuxManager()
    this.taskQueue = taskQueue ?? new TaskQueueManager()
    this.activeSessions = new Map()

    // Start background poller for session health/exit detection
    setInterval(() => this.checkSessionHealth(), 2000)
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

      // Auto-transition to initializing phase
      updateSessionPhase(session.id, "initializing")

      // Add initial activity event
        addActivity(session.id, {
          type: "session_start",
          timestamp: new Date(),
          title: "Session started",
          detail: session.issueNumber
            ? `Initializing AI for issue #${session.issueNumber}`
            : `Initializing AI for ${session.name}`,
          icon: "S",
        })

      if (options.aiSessionData !== undefined) {
        setAISessionData(session.id, options.aiSessionData)
      }

      const logPath = getSessionLogPath(this.projectRoot, session.id)
      await this.ensureLogFile(logPath)

      // Ensure log dir exists
      // (Assuming getLogsDir ensures it, or we do it here)
      // workspace/init.ts usually creates .openswe/logs, but let's be safe?
      // For now assume it exists.

      const args = ["--prompt", JSON.stringify(options.prompt)] // JSON stringify prompt to handle newlines/quotes safely in shell
      if (options.resumeSessionId) {
        args.push("--session", options.resumeSessionId)
      }

      // Filter env to remove undefined values
      const env = Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v !== undefined)
      ) as Record<string, string>

      // Spawn tmux session
      const pid = await this.processManager.spawn(
        session.id,
        "opencode",
        args,
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
      this.taskQueue.createFromRetryFailed(session.id)
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
   * Get the current visual state of the session for preview
   */
  async getSnapshot(sessionId: string): Promise<string[]> {
    try {
      const snapshot = await this.processManager.getSnapshot(sessionId)
      // Save to DB for persistence/caching if needed?
      // For now just return
      setLines(sessionId, snapshot.lines) // Update DB cache for when we are offline/paused
      return snapshot.lines
    } catch {
      // If session not running, return cached lines from DB
      const session = getSession(sessionId)
      // return session?.outputBuffer ... (need to fetch from OB table)
      return []
    }
  }

  /**
   * Get command to attach to this session
   */
  getAttachCommand(sessionId: string): string[] {
    return this.processManager.getAttachCommand(sessionId)
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

    // Parse activity events for timeline display
    const activity = parseActivityFromLine(normalizedLine)
    if (activity) {
      addActivity(sessionId, activity)
    }

    // Parse protocol events for state management
    const event = parseOutputLine(normalizedLine)
    if (!event) return

    switch (event.type) {
      case "phase":
        if (event.payload && isValidPhase(event.payload)) {
          updateSessionPhase(sessionId, event.payload)
        }
        break
      case "done":
        updateSessionPhase(sessionId, "pr_creation")
        this.handleSessionCompletion(sessionId).catch((err) => {
          logger.error(`PR creation failed for ${sessionId}:`, err)
        })
        break
      case "blocker":
        if (event.payload) {
          this.taskQueue.createFromBlocker(sessionId, event.payload)
        }
        break
      case "question":
        if (event.payload) {
          this.taskQueue.createFromQuestion(sessionId, event.payload)
        }
        break
      case "permission":
        if (event.payload) {
          this.taskQueue.createFromPermission(sessionId, event.payload)
        }
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

    if (!this.config.pr.autoCreate) {
      this.completeSession(sessionId)
      logger.info(`Session ${session.name} completed (auto PR disabled)`)
      return
    }

    const baseBranch = await getDefaultBranch(session.worktreePath) ?? "main"
    const commitsAhead = await getCommitsAhead(session.worktreePath, baseBranch)
    if (commitsAhead === 0) {
      this.completeSession(sessionId)
      logger.info(`Session ${session.name} completed (no commits to push)`)
      return
    }

    logger.info(`Session ${session.name}: ${commitsAhead} commits ahead, pushing branch...`)
    const pushResult = await pushBranch(session.worktreePath, session.branchName, true)
    if (!pushResult.success) {
      updateSessionStatus(sessionId, "needs_attention", `Push failed: ${pushResult.error}`)
      this.taskQueue.createFromBlocker(sessionId, `Failed to push branch: ${pushResult.error}`)
      return
    }

    const existingPR = await getExistingPR(session.worktreePath, session.branchName)
    if (existingPR) {
      setPrUrl(sessionId, existingPR)
      this.completeSession(sessionId)
      this.taskQueue.createPRReview(sessionId, existingPR)
      logger.info(`Session ${session.name} completed (existing PR: ${existingPR})`)
      return
    }

    logger.info(`Session ${session.name}: Creating PR...`)
    const prResult = await createPR({
      repoPath: session.worktreePath,
      branchName: session.branchName,
      baseBranch,
      issueNumber: session.issueNumber,
      issueTitle: session.issueTitle,
      draft: this.config.pr.draft,
      titleTemplate: this.config.pr.titleTemplate,
      bodyTemplate: this.config.pr.bodyTemplate,
    })

    if (!prResult.success) {
      updateSessionStatus(sessionId, "needs_attention", `PR creation failed: ${prResult.error}`)
      this.taskQueue.createFromBlocker(sessionId, `Failed to create PR: ${prResult.error}`)
      return
    }

    setPrUrl(sessionId, prResult.prUrl!)
    this.completeSession(sessionId)
    this.taskQueue.createPRReview(sessionId, prResult.prUrl!)
    logger.info(`Session ${session.name} completed - PR created: ${prResult.prUrl}`)
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
        this.taskQueue.createFromRetryFailed(sessionId)
      } else {
        // Auto-restart? Or just queue?
        // Logic says "queued" to retry.
        updateSessionStatus(sessionId, "queued")
      }
    }
    setPid(sessionId, null)
  }
}
