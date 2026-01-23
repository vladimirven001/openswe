/**
 * Session lifecycle manager
 *
 * Coordinates PTY sessions, output parsing, and state transitions.
 * Handles PR automation when sessions complete.
 */

import type { IExitEvent } from "bun-pty"
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
} from "../store"
import type { AISessionData } from "../store"
import type { GlobalConfig } from "../config"
import { parseOutputLine } from "./parser"
import type { PTYSession, SpawnOptions } from "./pty"
import { PTYManager } from "./pty"
import { TaskQueueManager } from "./queue"
import { pushBranch, getCommitsAhead, getDefaultBranch } from "../git"
import { createPR, getExistingPR } from "../github"
import { logger } from "../utils/logger"

export interface StartSessionOptions {
  sessionId: string
  prompt: string
  resumeSessionId?: string
  aiSessionData?: AISessionData | null
}

interface ActiveSessionListeners {
  stopLineListener: () => void
  stopExitListener: () => void
}

/**
 * Check if a process is still running
 */
function isProcessAlive(pid: number): boolean {
  try {
    // Sending signal 0 tests if process exists without killing it
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export class SessionManager {
  private config: GlobalConfig
  private ptyManager: PTYManager
  private taskQueue: TaskQueueManager
  private listeners: Map<string, ActiveSessionListeners>

  constructor(
    config: GlobalConfig,
    ptyManager?: PTYManager,
    taskQueue?: TaskQueueManager
  ) {
    this.config = config
    this.ptyManager = ptyManager ?? new PTYManager()
    this.taskQueue = taskQueue ?? new TaskQueueManager()
    this.listeners = new Map()
  }

  /**
   * Recover sessions that were active when the app was last closed
   *
   * Call this on startup to handle orphaned sessions.
   */
  recoverSessions(): void {
    const activeSessions = getSessionsByStatus("active")

    for (const session of activeSessions) {
      let shouldRecover = false

      // Check if we have a live PTY for this session
      const ptySession = this.ptyManager.getSession(session.id)
      if (!ptySession) {
        shouldRecover = true
      }

      // Double-check via PID if we have one
      if (session.pid !== null && !isProcessAlive(session.pid)) {
        shouldRecover = true
      }

      if (shouldRecover) {
        // Transition to paused so user can resume
        updateSessionStatus(session.id, "paused")
        setPid(session.id, null)
        logger.info(`Recovered session "${session.name}" - marked as paused`)
      }
    }
  }

  startSession(options: StartSessionOptions): PTYSession {
    const session = getSession(options.sessionId)
    if (!session) {
      throw new Error(`Session not found: ${options.sessionId}`)
    }

    try {
      updateSessionStatus(session.id, "active")

      if (options.aiSessionData !== undefined) {
        setAISessionData(session.id, options.aiSessionData)
      }

      const spawnOptions: SpawnOptions = {
        sessionId: session.id,
        worktreePath: session.worktreePath,
        prompt: options.prompt,
        resumeSessionId: options.resumeSessionId,
      }

      const ptySession = this.ptyManager.spawnSession(spawnOptions)
      setPid(session.id, ptySession.pid)

      const stopLineListener = ptySession.buffer.onLine((line) =>
        this.handleOutputLine(session.id, line)
      )
      const stopExitListener = ptySession.onExit((event) =>
        this.handleExit(session.id, event)
      )

      this.listeners.set(session.id, { stopLineListener, stopExitListener })

      return ptySession
    } catch (error) {
      // Spawning failed - mark as failed
      updateSessionStatus(session.id, "failed")
      logger.error(`Failed to start session ${session.id}:`, error)

      // Create a human task for the failure
      this.taskQueue.createFromRetryFailed(session.id)

      throw error
    }
  }

  pauseSession(sessionId: string): void {
    // Save buffer to database before killing
    const ptySession = this.ptyManager.getSession(sessionId)
    if (ptySession) {
      const lines = ptySession.buffer.getLines()
      setLines(sessionId, lines)
    }

    this.ptyManager.killSession(sessionId)
    this.clearListeners(sessionId)
    updateSessionStatus(sessionId, "paused")
    setPid(sessionId, null)
  }

  stopSession(sessionId: string): void {
    // Save buffer to database before killing
    const ptySession = this.ptyManager.getSession(sessionId)
    if (ptySession) {
      const lines = ptySession.buffer.getLines()
      setLines(sessionId, lines)
    }

    this.ptyManager.killSession(sessionId)
    this.clearListeners(sessionId)
    updateSessionStatus(sessionId, "queued")
    setPid(sessionId, null)
  }

  takeoverSession(sessionId: string): PTYSession | null {
    return this.ptyManager.getSession(sessionId)
  }

  private handleOutputLine(sessionId: string, line: string): void {
    const event = parseOutputLine(line)
    if (!event) return

    switch (event.type) {
      case "phase":
        if (event.payload && isValidPhase(event.payload)) {
          updateSessionPhase(sessionId, event.payload)
        }
        break
      case "done":
        // Mark phase as pr_creation first
        updateSessionPhase(sessionId, "pr_creation")

        // Trigger async PR workflow (don't block parsing)
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

  /**
   * Handle session completion - push branch and create PR if configured
   */
  private async handleSessionCompletion(sessionId: string): Promise<void> {
    const session = getSession(sessionId)
    if (!session) return

    // Check if auto PR is enabled
    if (!this.config.pr.autoCreate) {
      updateSessionPhase(sessionId, "completed")
      updateSessionStatus(sessionId, "completed")
      setPid(sessionId, null)
      logger.info(`Session ${session.name} completed (auto PR disabled)`)
      return
    }

    // Get base branch
    const baseBranch = await getDefaultBranch(session.worktreePath) ?? "main"

    // Check if there are commits to push
    const commitsAhead = await getCommitsAhead(session.worktreePath, baseBranch)
    if (commitsAhead === 0) {
      // No commits - mark complete without PR
      updateSessionPhase(sessionId, "completed")
      updateSessionStatus(sessionId, "completed")
      setPid(sessionId, null)
      logger.info(`Session ${session.name} completed (no commits to push)`)
      return
    }

    logger.info(`Session ${session.name}: ${commitsAhead} commits ahead, pushing branch...`)

    // Push branch
    const pushResult = await pushBranch(session.worktreePath, session.branchName, true)
    if (!pushResult.success) {
      updateSessionStatus(sessionId, "needs_attention", `Push failed: ${pushResult.error}`)
      this.taskQueue.createFromBlocker(sessionId, `Failed to push branch: ${pushResult.error}`)
      return
    }

    // Check if PR already exists
    const existingPR = await getExistingPR(session.worktreePath, session.branchName)
    if (existingPR) {
      // PR already exists - just update and complete
      setPrUrl(sessionId, existingPR)
      updateSessionPhase(sessionId, "completed")
      updateSessionStatus(sessionId, "completed")
      setPid(sessionId, null)
      this.taskQueue.createPRReview(sessionId, existingPR)
      logger.info(`Session ${session.name} completed (existing PR: ${existingPR})`)
      return
    }

    // Create PR
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

    // Success - update session and create review task
    setPrUrl(sessionId, prResult.prUrl!)
    updateSessionPhase(sessionId, "completed")
    updateSessionStatus(sessionId, "completed")
    setPid(sessionId, null)
    this.taskQueue.createPRReview(sessionId, prResult.prUrl!)
    logger.info(`Session ${session.name} completed - PR created: ${prResult.prUrl}`)
  }

  private handleExit(sessionId: string, event: IExitEvent): void {
    const session = getSession(sessionId)
    if (!session) return

    // Save buffer before cleanup
    const ptySession = this.ptyManager.getSession(sessionId)
    if (ptySession) {
      const lines = ptySession.buffer.getLines()
      setLines(sessionId, lines)
    }

    setPid(sessionId, null)
    this.clearListeners(sessionId)

    if (session.status === "completed" || session.status === "failed") {
      return
    }

    if (event.exitCode === 0) {
      updateSessionStatus(sessionId, "queued")
      return
    }

    const retryCount = incrementRetryCount(sessionId)
    if (retryCount >= 2) {
      updateSessionStatus(sessionId, "failed")
      this.taskQueue.createFromRetryFailed(sessionId)
    } else {
      updateSessionStatus(sessionId, "queued")
    }
  }

  private clearListeners(sessionId: string): void {
    const listeners = this.listeners.get(sessionId)
    if (!listeners) return
    listeners.stopLineListener()
    listeners.stopExitListener()
    this.listeners.delete(sessionId)
  }
}
