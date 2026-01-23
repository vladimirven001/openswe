/**
 * IssueSelectorModal component - Multi-select issue picker
 *
 * Fetches GitHub issues and allows selecting multiple to create sessions.
 */

import { createSignal, onMount, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { IssueSelectorModalProps } from "./types"
import type { Session } from "../store"
import { fetchIssues, formatRelativeTime, type GitHubIssue, type IssueState } from "../github"
import { createSessionFromIssue, findNextAvailableWorktreeName } from "./session-utils"
import { colors, borders } from "./theme"
import { logger } from "../utils/logger"

// Bold attribute constant
const BOLD = 1
const ITEMS_PER_PAGE = 6

/** State filter options */
const STATE_FILTERS: IssueState[] = ["open", "closed", "all"]

export function IssueSelectorModal(props: IssueSelectorModalProps) {
  // ============================================================================
  // State
  // ============================================================================

  const [issues, setIssues] = createSignal<GitHubIssue[]>([])
  const [selectedIndices, setSelectedIndices] = createSignal<Set<number>>(new Set())
  const [focusedIndex, setFocusedIndex] = createSignal(0)
  const [scrollOffset, setScrollOffset] = createSignal(0)
  const [stateFilter, setStateFilter] = createSignal<IssueState>("open")
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)
  const [creating, setCreating] = createSignal(false)

  // Conflict resolution state
  const [conflictIssue, setConflictIssue] = createSignal<GitHubIssue | null>(null)
  const [suggestedName, setSuggestedName] = createSignal<string>("")
  const [conflictChoice, setConflictChoice] = createSignal<0 | 1>(0) // 0: Create new, 1: Overwrite
  const [pendingIndices, setPendingIndices] = createSignal<number[]>([])
  const [successCount, setSuccessCount] = createSignal(0)
  const [createdSessions, setCreatedSessions] = createSignal<Session[]>([])

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadIssues = async () => {
    setLoading(true)
    setError(null)

    logger.debug("Loading issues", {
      repo: props.ownerRepo,
      state: stateFilter(),
    })

    const result = await fetchIssues(props.ownerRepo, {
      state: stateFilter(),
      limit: 500,
    })

    setLoading(false)

    if (result.success) {
      setIssues(result.issues)
      setFocusedIndex(0)
      setScrollOffset(0)
      setSelectedIndices(new Set<number>())
      logger.debug("Issues loaded", { count: result.issues.length })
    } else {
      setError(result.error ?? "Failed to fetch issues")
      setIssues([])
      logger.warn("Issue fetch failed", result.error)
    }
  }

  onMount(() => {
    loadIssues()
  })

  // ============================================================================
  // Actions
  // ============================================================================

  const toggleSelection = (index: number) => {
    setSelectedIndices((prev) => {
      const newSet = new Set<number>(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const cycleStateFilter = () => {
    const currentIndex = STATE_FILTERS.indexOf(stateFilter())
    const nextIndex = (currentIndex + 1) % STATE_FILTERS.length
    setStateFilter(STATE_FILTERS[nextIndex]!)
    loadIssues()
  }

  // Recursive function to process the queue of selected issues
  const processNextIssue = async () => {
    const indices = pendingIndices()
    if (indices.length === 0) {
      // All done
      finishCreation()
      return
    }

    const index = indices[0]! // Get first
    const issueList = issues()
    const issue = issueList[index]

    if (!issue) {
      // Skip invalid index
      setPendingIndices(indices.slice(1))
      await processNextIssue()
      return
    }

    // Try to create session normally first
    const result = await createSessionFromIssue(props.projectRoot, issue)

    if (result.success && result.session) {
      setSuccessCount((c) => c + 1)
      setCreatedSessions((prev) => [...prev, result.session!])
      logger.debug("Session created from issue", { issueNumber: issue.number })
      // Remove from queue and continue
      setPendingIndices(indices.slice(1))
      await processNextIssue()
    } else if (!result.success) {
      // Check if it's a conflict
      if (result.error?.toLowerCase().includes("already exists")) {
        // Find suggested name
        const suggestion = await findNextAvailableWorktreeName(props.projectRoot, issue.number)
        
        // Pause and show conflict UI
        setConflictIssue(issue)
        setSuggestedName(suggestion)
        setConflictChoice(0) // Default to "Create new"
        // Don't remove from queue yet, we'll process it after resolution
      } else {
        // Other error, just log and continue
        logger.warn("Failed to create session from issue", {
          issueNumber: issue.number,
          error: result.error,
        })
        setError(result.error ?? "Failed to create session")
        
        // Remove from queue and continue
        setPendingIndices(indices.slice(1))
        await processNextIssue()
      }
    }
  }

  const resolveConflict = async () => {
    const issue = conflictIssue()
    if (!issue) return

    const choice = conflictChoice()
    const suggestion = suggestedName()
    
    // Create with chosen strategy
    const result = await createSessionFromIssue(props.projectRoot, issue, {
      worktreeNameOverride: choice === 0 ? suggestion : undefined,
      overwrite: choice === 1
    })

    if (result.success && result.session) {
      setSuccessCount((c) => c + 1)
      setCreatedSessions((prev) => [...prev, result.session!])
      logger.debug("Session created after conflict resolution", { issueNumber: issue.number })
    } else {
      logger.warn("Failed to create session after conflict resolution", {
        issueNumber: issue.number,
        error: result.error,
      })
      setError(result.error ?? "Failed to create session")
    }

    // Clear conflict state
    setConflictIssue(null)
    setSuggestedName("")
    
    // Remove current issue from queue (it's done now)
    setPendingIndices((prev) => prev.slice(1))
    
    // Continue processing
    await processNextIssue()
  }

  const finishCreation = () => {
    setCreating(false)
    const created = createdSessions()
    if (created.length > 0) {
      props.onSessionsCreated(created)
      props.onClose()
    }
  }

  const startCreation = async () => {
    let selected = new Set(selectedIndices())

    // Auto-select focused if nothing selected
    if (selected.size === 0 && issues().length > 0) {
      const focused = focusedIndex()
      selected.add(focused)
      toggleSelection(focused)
    }

    if (selected.size === 0) return

    setCreating(true)
    setSuccessCount(0)
    setError(null)
    setCreatedSessions([])
    
    // Initialize queue
    setPendingIndices(Array.from(selected))
    
    logger.debug("Creating sessions from selected issues", {
      selectedCount: selected.size,
    })

    // Start processing
    await processNextIssue()
  }

  // ============================================================================
  // Keyboard Handling
  // ============================================================================

  useKeyboard((event) => {
    // If conflict UI is open, handle keys there
    if (conflictIssue()) {
      switch (event.name) {
        case "up":
        case "k":
          setConflictChoice(0)
          break
        case "down":
        case "j":
          setConflictChoice(1)
          break
        case "enter":
        case "return":
          resolveConflict()
          break
        case "escape":
          // Cancel everything
          setConflictIssue(null)
          setPendingIndices([])
          setCreating(false)
          break
      }
      return
    }

    const issueList = issues()
    if (loading() || creating()) return

    switch (event.name) {
      case "j":
      case "down":
        if (issueList.length > 0) {
          const nextIndex = Math.min(focusedIndex() + 1, issueList.length - 1)
          setFocusedIndex(nextIndex)
          if (nextIndex >= scrollOffset() + ITEMS_PER_PAGE) {
            setScrollOffset(nextIndex - ITEMS_PER_PAGE + 1)
          }
        }
        break

      case "k":
      case "up":
        if (issueList.length > 0) {
          const prevIndex = Math.max(focusedIndex() - 1, 0)
          setFocusedIndex(prevIndex)
          if (prevIndex < scrollOffset()) {
            setScrollOffset(prevIndex)
          }
        }
        break

      case "space":
        if (issueList.length > 0) {
          toggleSelection(focusedIndex())
        }
        break

      case "tab":
        cycleStateFilter()
        break

      case "return":
        startCreation()
        break

      case "escape":
        props.onClose()
        break

      case "a":
        // Select all
        if (issueList.length > 0) {
          const allIndices = new Set<number>(issueList.map((_, i) => i))
          if (selectedIndices().size === issueList.length) {
            setSelectedIndices(new Set<number>())
          } else {
            setSelectedIndices(allIndices)
          }
        }
        break

      case "r":
        // Refresh
        loadIssues()
        break
    }
  })

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const truncate = (text: string, maxLen: number): string => {
    if (text.length <= maxLen) return text
    return text.slice(0, maxLen - 1) + "…"
  }

  const formatLabels = (labels: { name: string }[]): string => {
    if (labels.length === 0) return ""
    const names = labels.slice(0, 3).map((l) => l.name)
    if (labels.length > 3) {
      names.push(`+${labels.length - 3}`)
    }
    return names.join(", ")
  }

  // ============================================================================
  // Render
  // ============================================================================

  const modalWidth = 70
  const modalHeight = 24
  const selectedCount = () => selectedIndices().size

  return (
    <box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
    >
      {/* Modal container */}
      <box
        flexDirection="column"
        width={modalWidth}
        height={modalHeight}
        backgroundColor={colors.bg.secondary}
        borderStyle="rounded"
        borderColor={colors.border.accent}
        overflow="hidden"
      >
        <Show when={!!conflictIssue()} fallback={
          // Standard Issue List View
          <>
            {/* Header */}
            <box height={1} paddingLeft={1} paddingRight={1} justifyContent="space-between">
              <text fg={colors.text.primary} attributes={BOLD}>
                Select Issues
              </text>
              <text fg={colors.text.muted}>
                {props.ownerRepo}
              </text>
            </box>

            {/* Filter bar */}
            <box height={1} paddingLeft={1} paddingRight={1} gap={2}>
              <text fg={colors.text.secondary}>Filter:</text>
              <For each={STATE_FILTERS}>
                {(state) => (
                  <text
                    fg={stateFilter() === state ? colors.accent.primary : colors.text.muted}
                    attributes={stateFilter() === state ? BOLD : 0}
                  >
                    {state}
                  </text>
                )}
              </For>
              <text fg={colors.text.muted}>[Tab to cycle]</text>
            </box>

            {/* Content area */}
            <box
              flexDirection="column"
              flexGrow={1}
              paddingLeft={1}
              paddingRight={1}
              paddingTop={1}
              overflow="hidden"
            >
              <Show when={loading()}>
                <box justifyContent="center" alignItems="center" flexGrow={1}>
                  <text fg={colors.text.muted}>Loading issues...</text>
                </box>
              </Show>

              <Show when={error() && !loading()}>
                <box justifyContent="center" alignItems="center" flexGrow={1}>
                  <text fg={colors.accent.error}>{error()}</text>
                </box>
              </Show>

              <Show when={!loading() && !error() && issues().length === 0}>
                <box justifyContent="center" alignItems="center" flexGrow={1}>
                  <text fg={colors.text.muted}>No issues found</text>
                </box>
              </Show>

              <Show when={!loading() && !error() && issues().length > 0}>
                <box
                  flexDirection="column"
                  flexGrow={1}
                  width="100%"
                >
                  <For each={issues().slice(scrollOffset(), scrollOffset() + ITEMS_PER_PAGE)}>
                    {(issue, i) => {
                      const index = () => scrollOffset() + i()
                      const isFocused = () => focusedIndex() === index()
                      const isSelected = () => selectedIndices().has(index())

                      return (
                        <box flexDirection="column" height={2} backgroundColor={colors.bg.secondary}>
                          {/* Issue line */}
                          <box flexDirection="row" gap={1}>
                            {/* Selection indicator */}
                            <box width={4}>
                              <text fg={isSelected() ? colors.accent.primary : colors.text.muted}>
                                {isSelected() ? "[✓]" : "[ ]"}
                              </text>
                            </box>

                            {/* Issue number */}
                            <box width={8}>
                              <text fg={isFocused() ? colors.accent.primary : colors.text.secondary}>
                                {`#${issue.number}`.padEnd(8)}
                              </text>
                            </box>

                            {/* Issue title */}
                            <text
                              fg={isFocused() ? colors.text.primary : colors.text.secondary}
                              attributes={isFocused() ? BOLD : 0}
                            >
                              {truncate(issue.title, 40)}
                            </text>
                          </box>

                          {/* Labels and time */}
                          <box flexDirection="row" gap={2} paddingLeft={12}>
                            <Show when={issue.labels.length > 0}>
                              <text fg={colors.text.muted}>
                                {formatLabels(issue.labels)}
                              </text>
                            </Show>
                            <text fg={colors.text.muted}>
                              {formatRelativeTime(issue.updatedAt)}
                            </text>
                          </box>
                        </box>
                      )
                    }}
                  </For>
                </box>
              </Show>
            </box>

            {/* Creating indicator */}
            <Show when={creating()}>
              <box height={1} justifyContent="center">
                <text fg={colors.accent.primary}>Creating sessions...</text>
              </box>
            </Show>

            {/* Separator */}
            <box height={1} paddingLeft={1} paddingRight={1}>
              <text fg={colors.border.primary}>
                {borders.panel.horizontal.repeat(modalWidth - 2)}
              </text>
            </box>

            {/* Footer */}
            <box
              height={1}
              justifyContent="center"
              paddingLeft={1}
              paddingRight={1}
              gap={2}
            >
              <text fg={colors.text.muted}>[Space] Toggle</text>
              <text fg={colors.text.muted}>[a] All</text>
              <Show when={selectedCount() > 0}>
                <text fg={colors.accent.primary}>[Enter] Create ({selectedCount()})</text>
              </Show>
              <Show when={selectedCount() === 0}>
                <text fg={issues().length > 0 ? colors.accent.primary : colors.text.muted}>[Enter] Create</text>
              </Show>
              <text fg={colors.text.muted}>[Esc] Close</text>
            </box>
          </>
        }>
          {/* Conflict Resolution View */}
          <box flexDirection="column" flexGrow={1} padding={2} justifyContent="center" alignItems="center">
            <text fg={colors.accent.error} attributes={BOLD}>Worktree Conflict</text>
            
            <box height={1} />
            
            <text fg={colors.text.primary}>
              Worktree for issue #{conflictIssue()?.number} already exists.
            </text>
            <text fg={colors.text.secondary}>
              Please select an action:
            </text>
            
            <box height={2} />
            
            {/* Options */}
            <box flexDirection="column" gap={1} width={50}>
              {/* Create new option */}
              <box flexDirection="row" gap={1}>
                <text fg={conflictChoice() === 0 ? colors.accent.primary : colors.text.muted}>
                  {conflictChoice() === 0 ? "●" : "○"}
                </text>
                <text 
                  fg={conflictChoice() === 0 ? colors.text.primary : colors.text.secondary}
                  attributes={conflictChoice() === 0 ? BOLD : 0}
                >
                  Create new worktree ({suggestedName()})
                </text>
              </box>
              
              {/* Overwrite option */}
              <box flexDirection="row" gap={1}>
                <text fg={conflictChoice() === 1 ? colors.accent.primary : colors.text.muted}>
                  {conflictChoice() === 1 ? "●" : "○"}
                </text>
                <text 
                  fg={conflictChoice() === 1 ? colors.text.primary : colors.text.secondary}
                  attributes={conflictChoice() === 1 ? BOLD : 0}
                >
                  Overwrite worktree
                </text>
              </box>
            </box>
            
            <box height={2} />
            
            <box flexDirection="row" gap={2}>
              <text fg={colors.accent.primary}>[Enter] Confirm</text>
              <text fg={colors.text.muted}>[Esc] Cancel</text>
            </box>
          </box>
        </Show>
      </box>
    </box>
  )
}
