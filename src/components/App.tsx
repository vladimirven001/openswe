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
import { useKeyboard, useRenderer } from "@opentui/solid"
import type { Session } from "../store"
import {
  getAllSessions,
  getProject,
  updateSessionStatus,
  getSession,
} from "../store"
import { SessionManager } from "../core"
import { generateSWEPrompt } from "../prompts"
import type { AppProps, ModalType, ProjectInfo, PendingAction } from "./types"
import type { ProviderBranding } from "../providers"
import type { AIBackend } from "../config"
import { saveGlobalConfig } from "../config"
import { StatusBar } from "./StatusBar"
import { SessionList } from "./SessionList"
import { Preview } from "./Preview"
import { HelpModal } from "./HelpModal"
import { ConfirmDialog } from "./ConfirmDialog"
import { IssueSelectorModal } from "./IssueSelectorModal"
import { ManualSessionModal } from "./ManualSessionModal"
import { ProviderSwitcherModal } from "./ProviderSwitcherModal"
import { ThemeSwitcherModal } from "./ThemeSwitcherModal"
import { deleteSessionWithWorktree } from "./session-utils"
import { useColors } from "./theme"
import { useTheme } from "../theme"
import { logger } from "../utils/logger"

/** Refresh interval for polling data (24 fps) */
const REFRESH_INTERVAL = (1/60) * 1000

export function App(props: AppProps) {
  const sessionManager = new SessionManager(props.config, props.projectRoot)
  const renderer = useRenderer()
  const { themeName, setTheme } = useTheme()
  const colors = useColors()

  // Get provider branding from session manager (reactive)
  const [providerBranding, setProviderBranding] = createSignal<ProviderBranding>(
    sessionManager.getProvider().branding
  )

  // ============================================================================
  // State
  // ============================================================================

  const [sessions, setSessions] = createSignal<Session[]>([])
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [projectInfo, setProjectInfo] = createSignal<ProjectInfo | null>(null)
  const [snapshotLines, setSnapshotLines] = createSignal<string[]>([])
  const [sessionStartedAt, setSessionStartedAt] = createSignal<Date | undefined>(undefined)
  const [activeModal, setActiveModal] = createSignal<ModalType>("none")
  const [pendingAction, setPendingAction] = createSignal<PendingAction | null>(null)
  const [isAttaching, setIsAttaching] = createSignal(false)

  // Terminal size tracking
  const [termSize, setTermSize] = createSignal({ cols: process.stdout.columns, rows: process.stdout.rows })

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

  const sessionListWidth = () => Math.floor(termSize().cols * 0.3)

  // Calculate optimal terminal size for preview
  const previewSize = () => {
    const { cols, rows } = termSize()
    // Preview is 70% width. Subtract 4 for borders/padding.
    // Height is full minus header/footer status bars (2 lines) and borders (2 lines)
    // We use rows - 2 to be aggressive and fill the space, allowing slight scroll if needed
    // rather than showing a gap.
    return {
      cols: Math.max(20, Math.floor(cols * 0.7) - 4),
      rows: Math.max(10, rows - 2)
    }
  }

  // Generate worktree command for selected session
  const worktreeCommand = (): string | undefined => {
    const session = selectedSession()
	return session?.worktreePath ? `cd '${session.worktreePath.replace(/'/g, "'\\''")}'` : undefined
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

  const loadProjectInfo = () => {
    try {
      const project = getProject()
      if (project) {
        setProjectInfo({
          repoFullName: project.repoFullName,
          repoUrl: project.repoUrl,
        })
        logger.debug("Loaded project info", project)
      } else {
        logger.warn("Project info missing from database")
      }
    } catch {
      setProjectInfo(null)
      logger.warn("Failed to load project info")
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
    loadProjectInfo()

    // Set up periodic refresh for dashboard data
    const refreshId = setInterval(() => {
      loadSessions()
    }, REFRESH_INTERVAL)

    // Set up faster refresh for preview activities
    const previewId = setInterval(() => {
      const session = selectedSession()
      if (session && session.status === "active") {
        sessionManager.getSnapshot(session.id).then(lines => {
          setSnapshotLines(lines)
        }).catch(() => setSnapshotLines([]))
        
        // Sync terminal size if not currently attaching/attached
        if (!isAttaching()) {
          const size = previewSize()
          sessionManager.resizeSession(session.id, size.cols, size.rows).catch(() => {})
        }
      }
    }, REFRESH_INTERVAL)

    // Handle Window Resize
    const onResize = () => {
      setTermSize({ cols: process.stdout.columns, rows: process.stdout.rows })
    }
    process.on('SIGWINCH', onResize)

    onCleanup(() => {
      clearInterval(refreshId)
      clearInterval(previewId)
      process.off('SIGWINCH', onResize)
    })
  })

  // Load preview activities when selection changes
  createEffect(() => {
    const session = selectedSession()
    if (session) {
      // Track session start time for duration display
      if (session.status === "active" && session.createdAt) {
        setSessionStartedAt(new Date(session.createdAt))
        
        // Resize immediately on selection, but only if not attaching
        if (!isAttaching()) {
          const size = previewSize()
          sessionManager.resizeSession(session.id, size.cols, size.rows).catch(() => {})
        }
      } else {
        setSessionStartedAt(undefined)
      }
    } else {
      setSessionStartedAt(undefined)
    }
  })

  // ============================================================================
  // Keyboard Handling
  // ============================================================================

  useKeyboard((event) => {
    const modal = activeModal()

    // Handle modal-specific keys
    if (modal === "confirm-delete") {
      switch (event.name) {
        case "escape":
          setPendingAction(null)
          setActiveModal("none")
          break

        case "return": {
          const action = pendingAction()
          if (action && action.type === "delete") {
            deleteSessionWithWorktree(props.projectRoot, action.sessionId).then(() => {
              setPendingAction(null)
              setActiveModal("none")
              loadSessions()
            })
          }
          break
        }
      }
      return
    }

    if (modal !== "none") {
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
        setActiveModal("manual")
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

      case "r": {
        const session = selectedSession()
        if (session) {
          sessionManager.reloadSession(session.id).then(() => {
            loadSessions()
          }).catch((error) => {
            logger.error("Failed to reload session:", error)
          })
        }
        break
      }

      case "return":
        // Full takeover mode - start session if needed, then attach
        (async () => {
          const session = selectedSession()
          if (!session) return

          setIsAttaching(true)

          try {
            // If session needs starting, start it first and await completion
            if (session.status === "queued" || session.status === "paused") {
              await sessionManager.startSession({
                sessionId: session.id,
                prompt: session.issueNumber ? generateSWEPrompt(session) : undefined,
                resumeSessionId: session.aiSessionData?.sessionId,
              })
            }

            // Re-fetch session to get updated status after start
            const updatedSession = getSession(session.id)
            if (updatedSession?.status === "active") {
              // Resize to full terminal size for interactive use
              await sessionManager.resizeSession(session.id, termSize().cols, termSize().rows)

              // Set terminal and window title to "openswe"
              process.stdout.write("\x1b]0;openswe\x07")
              await sessionManager.setWindowTitle(session.id, "openswe")

              const cmd = sessionManager.getAttachCommand(session.id)

              // Suspend OpenTUI before yielding terminal to tmux
              renderer.suspend()

              Bun.spawnSync(cmd, { stdio: ["inherit", "inherit", "inherit"] })

              // Resume OpenTUI - this properly re-establishes terminal state
              renderer.resume()

              // Resize back to preview size
              const size = previewSize()
              await sessionManager.resizeSession(session.id, size.cols, size.rows)
            }

            loadSessions()
          } catch (error) {
            logger.error("Session start/attach failed:", error)
            loadSessions()
          } finally {
            setIsAttaching(false)
          }
        })()
        break

      // Modal triggers
      case "i":
        if (projectInfo()) {
          setActiveModal("issues")
        } else {
          logger.warn("Cannot open issues modal: project info not loaded")
        }
        break

      case "?":
        setActiveModal("help")
        break

      case "a":
        setActiveModal("provider")
        break

      case "t":
        setActiveModal("theme")
        break

      // Quit
      case "q":
        renderer.destroy()
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
  // Provider Change Handler
  // ============================================================================

  const handleProviderChange = async (backend: AIBackend) => {
    sessionManager.setProvider(backend)
    setProviderBranding(sessionManager.getProvider().branding)
    setActiveModal("none")

    // Persist to config file
    try {
      await saveGlobalConfig({ ai: { backend } })
    } catch (error) {
      logger.error("Failed to save provider preference:", error)
    }
  }

  // ============================================================================
  // Theme Change Handler
  // ============================================================================

  const handleThemeChange = async (name: string) => {
    setTheme(name)
    setActiveModal("none")

    // Persist to config file
    try {
      await saveGlobalConfig({ ui: { theme: name } })
    } catch (error) {
      logger.error("Failed to save theme preference:", error)
    }
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={colors().bg.primary}
    >
      {/* Header Status Bar */}
      <StatusBar
        variant="header"
        repoName={projectInfo()?.repoFullName}
        backend={props.config.ai.backend}
        sessionId={selectedSession()?.id}
        worktreeCommand={worktreeCommand()}
        providerBranding={providerBranding()}
      />

      {/* Main Content Area */}
      <box flexDirection="row" flexGrow={1}>
        <SessionList
          sessions={sessions()}
          selectedIndex={selectedIndex()}
          onSelect={handleSelect}
          listWidth={sessionListWidth()}
        />
        <Preview
          session={selectedSession()}
          startedAt={sessionStartedAt()}
          snapshotLines={snapshotLines()}
          providerBranding={providerBranding()}
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
          currentBackend={props.config.ai.backend}
          onClose={() => setActiveModal("none")}
          onSessionsCreated={async (sessions) => {
            // Auto-start all created sessions
            for (const session of sessions) {
              try {
                await sessionManager.startSession({
                  sessionId: session.id,
                  prompt: generateSWEPrompt(session),
                })
              } catch (error) {
                logger.error("Failed to auto-start session", { sessionId: session.id, error })
              }
            }
            loadSessions()
          }}
        />
      </Show>

      <Show when={activeModal() === "manual"}>
        <ManualSessionModal
          projectRoot={props.projectRoot}
          currentBackend={props.config.ai.backend}
          sessionManager={sessionManager}
          onClose={() => setActiveModal("none")}
          onSessionCreated={() => loadSessions()}
        />
      </Show>

      <Show when={activeModal() === "provider"}>
        <ProviderSwitcherModal
          currentBackend={props.config.ai.backend}
          onSelect={handleProviderChange}
          onClose={() => setActiveModal("none")}
        />
      </Show>

      <Show when={activeModal() === "theme"}>
        <ThemeSwitcherModal
          currentTheme={themeName()}
          onSelect={handleThemeChange}
          onClose={() => setActiveModal("none")}
        />
      </Show>
    </box>
  )
}
