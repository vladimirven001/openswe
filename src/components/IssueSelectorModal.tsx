import { createSignal, onMount, For, Show, createEffect, onCleanup } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { IssueSelectorModalProps } from "./types"
import type { Session } from "../store"
import { fetchIssues, formatRelativeTime, type GitHubIssue, type IssueState } from "../github"
import { createSessionFromIssue, findNextAvailableWorktreeName } from "./session-utils"
import { ScrollableText } from "./ScrollableText"
import { colors, borders } from "./theme"
import { Footer } from "./Footer"
import { logger } from "../utils/logger"

// Bold attribute constant
const BOLD = 1
const ITEMS_PER_PAGE = 7 // Increased slightly since rows are more compact
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

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
  const [spinnerFrame, setSpinnerFrame] = createSignal(0)

  // Animation effect
  createEffect(() => {
    if (creating()) {
      const interval = setInterval(() => {
        setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length)
      }, 80)
      onCleanup(() => clearInterval(interval))
    }
  })

  // Conflict resolution state
  const [conflictIssue, setConflictIssue] = createSignal<GitHubIssue | null>(null)
  const [suggestedName, setSuggestedName] = createSignal<string>("")
  const [conflictChoice, setConflictChoice] = createSignal<0 | 1 | 2>(0) // 0: Use existing, 1: Create new, 2: Overwrite
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
    // Check if cancelled
    if (!creating()) return

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
    const result = await createSessionFromIssue(props.projectRoot, issue, {
      aiSessionData: { backend: props.currentBackend }
    })
    
    // Check if cancelled during await
    if (!creating()) return

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
        
        // Check if cancelled during await
        if (!creating()) return

        // Pause and show conflict UI
        setConflictIssue(issue)
        setSuggestedName(suggestion)
        setConflictChoice(0) // Default to "Continue"
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
      	worktreeNameOverride: choice === 1 ? suggestion : undefined,
      	overwriteWorktreeChoice: choice, // Maps directly to OverwriteWorktreeChoice enum
        aiSessionData: { backend: props.currentBackend }
    })
    
    // Check if cancelled during await
    if (!creating()) return

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
			if (conflictChoice() != 0) {
          		setConflictChoice((conflictChoice() - 1) as 0 | 1 | 2)
			}
          	break
        case "down":
        case "j":
			if (conflictChoice() != 2) {
          		setConflictChoice((conflictChoice() + 1) as 0 | 1 | 2)
			}
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
    
    // Allow Escape to cancel creation or close modal
    if (event.name === "escape") {
      if (creating()) {
        // Cancel creation
        setPendingIndices([])
        setCreating(false)
        setConflictIssue(null)
      } else {
        props.onClose()
      }
      return
    }

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
    const names = labels.slice(0, 2).map((l) => `[${l.name}]`)
    if (labels.length > 2) {
      names.push(`+${labels.length - 2}`)
    }
    return names.join(" ")
  }

  // ============================================================================
  // Render
  // ============================================================================

  const modalWidth = 80
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
            {/* Header with Tabs */}
            <box 
              height={1} 
              paddingLeft={1} 
              paddingRight={1} 
              justifyContent="space-between"
              backgroundColor={colors.bg.secondary}
            >
              <box flexDirection="row" flexGrow={1} overflow="hidden" marginRight={2}>
                 <text fg={colors.text.primary} attributes={BOLD}>
                   {props.ownerRepo}
                 </text>
              </box>
              
              {/* Filter Tabs */}
              <box flexDirection="row" gap={1}>
                <For each={STATE_FILTERS}>
                  {(state) => (
                    <text
                      fg={stateFilter() === state ? colors.accent.primary : colors.text.muted}
                      attributes={stateFilter() === state ? BOLD : 0}
                    >
                      {stateFilter() === state ? `[ ${state} ]` : `  ${state}  `}
                    </text>
                  )}
                </For>
              </box>
            </box>

            {/* Content area */}
            <box
              flexDirection="column"
              flexGrow={1}
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

                      const textColor = () => isFocused() ? colors.text.primary : colors.text.secondary
                      const mutedColor = () => isFocused() ? colors.text.primary : colors.text.muted

                      return (
                        <box 
                          flexDirection="row" 
                          height={1} // Single line rows
                          backgroundColor={isFocused() ? colors.bg.cardSelected : undefined}
                          paddingLeft={0}
                          paddingRight={1}
                          alignItems="center"
                          overflow="hidden"
                        >
                          {/* Focus Indicator */}
                          <box width={2}>
                            <text fg={colors.accent.primary}>
                              {isFocused() ? "▍" : " "}
                            </text>
                          </box>

                          {/* Selection Checkbox */}
                          <box width={4}>
                            <text 
                              fg={isSelected() 
                                ? (isFocused() ? colors.text.primary : colors.accent.success) 
                                : mutedColor()
                              } 
                              attributes={isSelected() ? BOLD : 0}
                            >
                              {isSelected() ? "[✓]" : "[ ]"}
                            </text>
                          </box>

                          {/* Issue ID (Fixed width, right alignedish) */}
                          <box width={6}>
                            <text fg={textColor()}>
                              {`#${issue.number}`.padEnd(5)}
                            </text>
                          </box>

                          {/* Title (Flex) */}
                          <box flexGrow={1} marginRight={2} overflow="hidden">
                            <ScrollableText
                              text={issue.title}
                              width={30}
                              isActive={isFocused()}
                              fg={isFocused() ? colors.text.primary : colors.text.secondary}
                              attributes={isFocused() ? BOLD : 0}
                            />
                          </box>

                          {/* Labels (Variable) */}
                          <box width={20} overflow="hidden">
                             <Show when={issue.labels.length > 0}>
                                <text fg={mutedColor()}>
                                  {formatLabels(issue.labels)}
                                </text>
                              </Show>
                          </box>

                          {/* Time (Right aligned) */}
                          <box width={12} justifyContent="flex-end">
                            <text fg={mutedColor()}>
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
              <box height={1} flexDirection="row" justifyContent="center" paddingBottom={1} gap={1}>
                <text fg={colors.accent.primary}>{SPINNER_FRAMES[spinnerFrame()]}</text>
                <text fg={colors.accent.primary}>Creating sessions...</text>
              </box>
            </Show>

            {/* Footer */}
            <Footer
              bgColor={colors.bg.primary}
              actions={[
                { key: "Space", label: "Toggle" },
                { key: "a", label: "All" },
                { key: "Tab", label: "Filter" },
                ...(selectedCount() > 0 
                  ? [{ key: "Enter", label: `Create (${selectedCount()})` }]
                  : [{ key: "Enter", label: "Create" }]
                ),
                { key: "Esc", label: "Close" },
              ]}
            />
          </>
        }>
          {/* Conflict Resolution View */}
          <box flexDirection="column" width="100%" height="100%">
            <box flexDirection="column" flexGrow={1} padding={2} justifyContent="center" alignItems="center">
              <text fg={colors.accent.warning} attributes={BOLD}>Worktree Conflict</text>
              
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
			  {/* Continue worktree option*/}
                <box flexDirection="row" gap={1}>
                  <text fg={conflictChoice() === 0 ? colors.accent.primary : colors.text.muted}>
                    {conflictChoice() === 0 ? "●" : "○"}
                  </text>
                  <text 
                    fg={conflictChoice() === 0 ? colors.text.primary : colors.text.secondary}
                    attributes={conflictChoice() === 0 ? BOLD : 0}
                  >
                    Continue with existing worktree
                  </text>
                </box>

                {/* Create new option */}
                <box flexDirection="row" gap={1}>
                  <text fg={conflictChoice() === 1 ? colors.accent.primary : colors.text.muted}>
                    {conflictChoice() === 1 ? "●" : "○"}
                  </text>
                  <text 
                    fg={conflictChoice() === 1 ? colors.text.primary : colors.text.secondary}
                    attributes={conflictChoice() === 1 ? BOLD : 0}
                  >
                    Create new worktree ({suggestedName()})
                  </text>
                </box>
                
                {/* Overwrite option */}
                <box flexDirection="row" gap={1}>
                  <text fg={conflictChoice() === 2 ? colors.accent.primary : colors.text.muted}>
                    {conflictChoice() === 2 ? "●" : "○"}
                  </text>
                  <text 
                    fg={conflictChoice() === 2 ? colors.text.primary : colors.text.secondary}
                    attributes={conflictChoice() === 2 ? BOLD : 0}
                  >
                    Overwrite worktree
                  </text>
                </box>
              </box>
            </box>
            
            <Footer
              bgColor={colors.bg.primary}
              actions={[
                { key: "Enter", label: "Confirm" },
                { key: "Esc", label: "Cancel" },
              ]}
            />
          </box>
        </Show>
      </box>
    </box>
  )
}
