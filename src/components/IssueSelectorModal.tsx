/**
 * IssueSelectorModal component - Multi-select issue picker
 *
 * Fetches GitHub issues and allows selecting multiple to create sessions.
 */

import { createSignal, onMount, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { IssueSelectorModalProps } from "./types"
import { fetchIssues, formatRelativeTime, type GitHubIssue, type IssueState } from "../github"
import { createSessionFromIssue } from "./session-utils"
import { colors } from "./theme"

// Bold attribute constant
const BOLD = 1

/** State filter options */
const STATE_FILTERS: IssueState[] = ["open", "closed", "all"]

export function IssueSelectorModal(props: IssueSelectorModalProps) {
  // ============================================================================
  // State
  // ============================================================================

  const [issues, setIssues] = createSignal<GitHubIssue[]>([])
  const [selectedIndices, setSelectedIndices] = createSignal<Set<number>>(new Set())
  const [focusedIndex, setFocusedIndex] = createSignal(0)
  const [stateFilter, setStateFilter] = createSignal<IssueState>("open")
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)
  const [creating, setCreating] = createSignal(false)

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadIssues = async () => {
    setLoading(true)
    setError(null)

    const result = await fetchIssues(props.ownerRepo, {
      state: stateFilter(),
      limit: 50,
    })

    setLoading(false)

    if (result.success) {
      setIssues(result.issues)
      setFocusedIndex(0)
      setSelectedIndices(new Set<number>())
    } else {
      setError(result.error ?? "Failed to fetch issues")
      setIssues([])
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

  const createSessions = async () => {
    const selected = selectedIndices()
    if (selected.size === 0) return

    setCreating(true)
    const issueList = issues()
    let successCount = 0
    let lastError: string | null = null

    for (const index of selected) {
      const issue = issueList[index]
      if (!issue) continue

      const result = await createSessionFromIssue(props.projectRoot, issue)
      if (result.success) {
        successCount++
      } else {
        lastError = result.error ?? "Failed to create session"
      }
    }

    setCreating(false)

    if (successCount > 0) {
      props.onSessionsCreated()
      props.onClose()
    } else if (lastError) {
      setError(lastError)
    }
  }

  // ============================================================================
  // Keyboard Handling
  // ============================================================================

  useKeyboard((event) => {
    const issueList = issues()
    if (loading() || creating()) return

    switch (event.name) {
      case "j":
      case "down":
        if (issueList.length > 0) {
          setFocusedIndex((prev) => Math.min(prev + 1, issueList.length - 1))
        }
        break

      case "k":
      case "up":
        if (issueList.length > 0) {
          setFocusedIndex((prev) => Math.max(prev - 1, 0))
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
        if (selectedIndices().size > 0) {
          createSessions()
        }
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
      >
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
            <For each={issues().slice(0, 15)}>
              {(issue, index) => {
                const isFocused = () => focusedIndex() === index()
                const isSelected = () => selectedIndices().has(index())

                return (
                  <box flexDirection="column" paddingBottom={1}>
                    {/* Issue line */}
                    <box flexDirection="row" gap={1}>
                      {/* Selection indicator */}
                      <text fg={isSelected() ? colors.accent.primary : colors.text.muted}>
                        {isSelected() ? "[✓]" : "[ ]"}
                      </text>

                      {/* Issue number */}
                      <text fg={isFocused() ? colors.accent.primary : colors.text.secondary}>
                        #{issue.number.toString().padEnd(5)}
                      </text>

                      {/* Issue title */}
                      <text
                        fg={isFocused() ? colors.text.primary : colors.text.secondary}
                        attributes={isFocused() ? BOLD : 0}
                      >
                        {truncate(issue.title, 45)}
                      </text>
                    </box>

                    {/* Labels and time */}
                    <box flexDirection="row" gap={2} paddingLeft={6}>
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
          </Show>
        </box>

        {/* Creating indicator */}
        <Show when={creating()}>
          <box height={1} justifyContent="center">
            <text fg={colors.accent.primary}>Creating sessions...</text>
          </box>
        </Show>

        {/* Footer */}
        <box
          height={1}
          justifyContent="center"
          paddingLeft={1}
          paddingRight={1}
          borderStyle="single"
          borderColor={colors.border.primary}
          gap={2}
        >
          <text fg={colors.text.muted}>[Space] Toggle</text>
          <text fg={colors.text.muted}>[a] All</text>
          <Show when={selectedCount() > 0}>
            <text fg={colors.accent.primary}>[Enter] Create ({selectedCount()})</text>
          </Show>
          <Show when={selectedCount() === 0}>
            <text fg={colors.text.muted}>[Enter] Create</text>
          </Show>
          <text fg={colors.text.muted}>[Esc] Close</text>
        </box>
      </box>
    </box>
  )
}
