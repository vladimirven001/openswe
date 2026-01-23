/**
 * App component - root component for OpenSWE TUI
 *
 * Manages:
 * - State signals for sessions, selection, project info
 * - Data loading from store
 * - Keyboard navigation
 * - Layout structure
 */

import { createSignal, createEffect, onMount, onCleanup, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { Session } from "../store"
import {
  getAllSessions,
  getUnresolvedTaskCount,
  getProject,
  getAllLines,
  updateSessionStatus,
} from "../store"
import { SessionManager } from "../core"
import { generateSWEPrompt } from "../prompts"
import type { AppProps, ModalType, ProjectInfo, PendingAction } from "./types"
import { StatusBar } from "./StatusBar"
import { SessionList } from "./SessionList"
import { Preview } from "./Preview"
import { HelpModal } from "./HelpModal"
import { ConfirmDialog } from "./ConfirmDialog"
import { IssueSelectorModal } from "./IssueSelectorModal"
import { TaskQueueModal } from "./TaskQueueModal"
import { deleteSessionWithWorktree } from "./session-utils"
import { colors } from "./theme"

/** Refresh interval for polling data (5 seconds) */
const REFRESH_INTERVAL = 5000

export function App(props: AppProps) {
  const sessionManager = new SessionManager(props.config)

  // ============================================================================
  // State
  // ============================================================================

  const [sessions, setSessions] = createSignal<Session[]>([])
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [unresolvedTaskCount, setUnresolvedTaskCount] = createSignal(0)
  const [projectInfo, setProjectInfo] = createSignal<ProjectInfo | null>(null)
  const [previewLines, setPreviewLines] = createSignal<string[]>([])
  const [activeModal, setActiveModal] = createSignal<ModalType>("none")
  const [pendingAction, setPendingAction] = createSignal<PendingAction | null>(null)
  let stopLiveListener: (() => void) | null = null

  // ============================================================================
  // Derived State
  // ============================================================================

  const selectedSession = (): Session | null => {
    const sessionList = sessions()
    const index = selectedIndex()
    if (index >= 0 && index < sessionList.length) {
      return sessionList[index] ?? null
    }
    return null
  }

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadSessions = () => {
    try {
      const loadedSessions = getAllSessions()
      setSessions(loadedSessions)
      // Clamp selectedIndex to valid range
      if (loadedSessions.length > 0) {
        setSelectedIndex((prev) =>
          Math.min(prev, loadedSessions.length - 1)
        )
      } else {
        setSelectedIndex(0)
      }
    } catch {
      // Database might not be initialized
      setSessions([])
    }
  }

  const loadTaskCount = () => {
    try {
      setUnresolvedTaskCount(getUnresolvedTaskCount())
    } catch {
      setUnresolvedTaskCount(0)
    }
  }

  const loadProjectInfo = () => {
    try {
      const project = getProject()
      if (project) {
        setProjectInfo({
          repoFullName: project.repoFullName,
          repoUrl: project.repoUrl,
          maxActiveSessions: project.maxActiveSessions,
        })
      }
    } catch {
      setProjectInfo(null)
    }
  }

  const loadPreviewLines = (sessionId: string) => {
    try {
      const lines = getAllLines(sessionId)
      setPreviewLines(lines)
    } catch {
      setPreviewLines([])
    }
  }

  // ============================================================================
  // Effects
  // ============================================================================

  // Load initial data on mount and set up periodic refresh
  onMount(() => {
    // Recover any orphaned sessions from previous runs
    sessionManager.recoverSessions()

    loadSessions()
    loadTaskCount()
    loadProjectInfo()

    // Set up periodic refresh
    const intervalId = setInterval(() => {
      loadSessions()
      loadTaskCount()
    }, REFRESH_INTERVAL)

    onCleanup(() => clearInterval(intervalId))
  })

  // Load preview lines when selection changes
  createEffect(() => {
    const session = selectedSession()
    if (session) {
      if (stopLiveListener) {
        stopLiveListener()
        stopLiveListener = null
      }

      const ptySession = sessionManager.takeoverSession(session.id)
      if (session.status === "active" && ptySession) {
        setPreviewLines(ptySession.buffer.getLines())
        stopLiveListener = ptySession.buffer.onLine(() => {
          setPreviewLines(ptySession.buffer.getLines())
        })
      } else {
        loadPreviewLines(session.id)
      }
    } else {
      setPreviewLines([])
    }
  })

  onCleanup(() => {
    if (stopLiveListener) {
      stopLiveListener()
      stopLiveListener = null
    }
  })

  // ============================================================================
  // Keyboard Handling
  // ============================================================================

  useKeyboard((event) => {
    const modal = activeModal()

    // Handle modal-specific keys
    if (modal !== "none") {
      switch (event.name) {
        case "escape":
          setPendingAction(null)
          setActiveModal("none")
          break

        case "return":
          // Confirm action for confirm-delete modal
          if (modal === "confirm-delete") {
            const action = pendingAction()
            if (action && action.type === "delete") {
              deleteSessionWithWorktree(props.projectRoot, action.sessionId).then(() => {
                setPendingAction(null)
                setActiveModal("none")
                loadSessions()
              })
            }
          }
          break
      }
      return
    }

    const sessionList = sessions()

    switch (event.name) {
      // Navigation
      case "j":
      case "down":
        if (sessionList.length > 0) {
          setSelectedIndex((prev) =>
            Math.min(prev + 1, sessionList.length - 1)
          )
        }
        break

      case "k":
      case "up":
        if (sessionList.length > 0) {
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
        }
        break

      // Session actions
      case "n":
        // Create new session - opens issue selector (full implementation in Phase 8)
        setActiveModal("issues")
        break

      case "d": {
        const session = selectedSession()
        if (session) {
          setPendingAction({
            type: "delete",
            sessionId: session.id,
            sessionName: session.name,
          })
          setActiveModal("confirm-delete")
        }
        break
      }

      case "p": {
        const session = selectedSession()
        if (session) {
          if (session.status === "paused") {
            updateSessionStatus(session.id, "queued")
          } else if (session.status === "active" || session.status === "queued") {
            updateSessionStatus(session.id, "paused")
          }
          loadSessions()
        }
        break
      }

      case "r":
        loadSessions()
        loadTaskCount()
        break

      case "return":
        // Full takeover mode - start/resume session if not active
        try {
          const session = selectedSession()
          if (!session) break

          if (session.status === "queued" || session.status === "paused") {
            sessionManager.startSession({
              sessionId: session.id,
              prompt: generateSWEPrompt(session),
              resumeSessionId: session.aiSessionData?.sessionId,
            })
            loadSessions()
          }
        } catch {
          // If session start fails, keep UI responsive
        }
        break

      // Modal triggers
      case "t":
        setActiveModal("tasks")
        break

      case "i":
        setActiveModal("issues")
        break

      case "?":
        setActiveModal("help")
        break

      // Quit
      case "q":
        process.exit(0)
        break
    }
  })

  // ============================================================================
  // Selection Handler
  // ============================================================================

  const handleSelect = (index: number) => {
    setSelectedIndex(index)
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={colors.bg.primary}
    >
      {/* Header Status Bar */}
      <StatusBar
        variant="header"
        repoName={projectInfo()?.repoFullName}
        taskCount={unresolvedTaskCount()}
        backend={props.config.ai.backend}
      />

      {/* Main Content Area */}
      <box flexDirection="row" flexGrow={1}>
        <SessionList
          sessions={sessions()}
          selectedIndex={selectedIndex()}
          onSelect={handleSelect}
        />
        <Preview
          session={selectedSession()}
          lines={previewLines()}
        />
      </box>

      {/* Footer Status Bar */}
      <StatusBar variant="footer" />

      {/* Modal Overlays */}
      <Show when={activeModal() === "help"}>
        <HelpModal onClose={() => setActiveModal("none")} />
      </Show>

      <Show when={activeModal() === "confirm-delete" && pendingAction()}>
        <ConfirmDialog
          title="Delete Session?"
          message={`Are you sure you want to delete\n"${pendingAction()!.sessionName}"?\n\nThis will also remove the worktree.`}
          onConfirm={async () => {
            const action = pendingAction()
            if (action) {
              await deleteSessionWithWorktree(props.projectRoot, action.sessionId)
            }
            setPendingAction(null)
            setActiveModal("none")
            loadSessions()
          }}
          onCancel={() => {
            setPendingAction(null)
            setActiveModal("none")
          }}
        />
      </Show>

      <Show when={activeModal() === "issues" && projectInfo()}>
        <IssueSelectorModal
          ownerRepo={projectInfo()!.repoFullName}
          projectRoot={props.projectRoot}
          onClose={() => setActiveModal("none")}
          onSessionsCreated={() => loadSessions()}
        />
      </Show>

      <Show when={activeModal() === "tasks"}>
        <TaskQueueModal
          onClose={() => setActiveModal("none")}
          onJumpToSession={(sessionId) => {
            // Find session index and select it
            const idx = sessions().findIndex((s) => s.id === sessionId)
            if (idx >= 0) {
              setSelectedIndex(idx)
            }
            setActiveModal("none")
            // TODO Phase 11: Trigger takeover mode for the session
          }}
        />
      </Show>
    </box>
  )
}
