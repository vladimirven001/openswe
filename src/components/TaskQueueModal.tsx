/**
 * TaskQueueModal component - Human task queue overlay
 *
 * Displays tasks that require human intervention, sorted by priority.
 * Allows navigation to associated sessions.
 */

import { createSignal, onMount, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { HumanTask, TaskType, TaskPriority } from "../store"
import { getUnresolvedTasks } from "../store"
import type { TaskQueueModalProps } from "./types"
import { colors, borders } from "./theme"
import { formatRelativeTime } from "../utils/format"

// Bold attribute constant
const BOLD = 1

// ============================================================================
// Task Display Helpers
// ============================================================================

/** Icons for task types */
const TASK_TYPE_ICONS: Record<TaskType, string> = {
  question: "?",
  permission: "!",
  blocker: "B",
  retry_failed: "X",
  pr_review: "R",
}

/** Display names for task types */
const TASK_TYPE_NAMES: Record<TaskType, string> = {
  question: "Question",
  permission: "Permission",
  blocker: "Blocker",
  retry_failed: "Retry Failed",
  pr_review: "PR Review",
}

/** Colors for priorities */
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: colors.accent.error,
  high: colors.accent.warning,
  normal: colors.text.secondary,
  low: colors.text.muted,
}

/** Priority sort order (lower = higher priority) */
const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
}

/**
 * Sort tasks by priority (critical → high → normal → low), then by creation time (newest first)
 */
function sortTasks(tasks: HumanTask[]): HumanTask[] {
  return [...tasks].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    // Same priority: sort by creation time (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1) + "…"
}

// ============================================================================
// Component
// ============================================================================

export function TaskQueueModal(props: TaskQueueModalProps) {
  const modalWidth = 70
  const modalHeight = 22
  const listHeight = modalHeight - 6 // Account for header(1), separator(1), footer(2 with separator), border(2)

  // State
  const [tasks, setTasks] = createSignal<HumanTask[]>([])
  const [selectedIndex, setSelectedIndex] = createSignal(0)

  // Load tasks on mount
  onMount(() => {
    const unresolvedTasks = getUnresolvedTasks()
    setTasks(sortTasks(unresolvedTasks))
  })

  // Derived: selected task
  const selectedTask = (): HumanTask | null => {
    const taskList = tasks()
    const index = selectedIndex()
    if (index >= 0 && index < taskList.length) {
      return taskList[index] ?? null
    }
    return null
  }

  // Keyboard handling
  useKeyboard((event) => {
    const taskList = tasks()

    switch (event.name) {
      case "escape":
        props.onClose()
        break

      case "j":
      case "down":
        if (taskList.length > 0) {
          setSelectedIndex((prev) => Math.min(prev + 1, taskList.length - 1))
        }
        break

      case "k":
      case "up":
        if (taskList.length > 0) {
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
        }
        break

      case "return": {
        const task = selectedTask()
        if (task) {
          props.onJumpToSession(task.sessionId)
        }
        break
      }
    }
  })

  // Calculate visible window for scrolling
  const getVisibleRange = () => {
    const index = selectedIndex()
    const total = tasks().length
    const maxVisible = listHeight

    if (total <= maxVisible) {
      return { start: 0, end: total }
    }

    // Keep selected item centered when possible
    let start = Math.max(0, index - Math.floor(maxVisible / 2))
    const end = Math.min(total, start + maxVisible)

    // Adjust start if we're near the end
    if (end === total) {
      start = Math.max(0, total - maxVisible)
    }

    return { start, end }
  }

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
        {/* Header */}
        <box
          height={1}
          justifyContent="center"
          paddingLeft={1}
          paddingRight={1}
        >
          <text fg={colors.text.primary} attributes={BOLD}>
            Human Tasks ({tasks().length})
          </text>
        </box>

        {/* Separator */}
        <box height={1}>
          <text fg={colors.border.primary}>
            {"─".repeat(modalWidth - 2)}
          </text>
        </box>

        {/* Content area */}
        <box flexDirection="row" flexGrow={1}>
          {/* Task list */}
          <box
            flexDirection="column"
            width="55%"
            paddingLeft={1}
            paddingRight={1}
          >
            <Show
              when={tasks().length > 0}
              fallback={
                <box
                  flexGrow={1}
                  justifyContent="center"
                  alignItems="center"
                >
                  <text fg={colors.text.muted}>No pending tasks</text>
                </box>
              }
            >
              <For each={tasks().slice(getVisibleRange().start, getVisibleRange().end)}>
                {(task, localIndex) => {
                  const actualIndex = () => getVisibleRange().start + localIndex()
                  const isSelected = () => actualIndex() === selectedIndex()

                  return (
                    <box
                      flexDirection="row"
                      minHeight={2}
                      backgroundColor={isSelected() ? colors.bg.cardSelected : undefined}
                      paddingLeft={1}
                      paddingRight={1}
                      overflow="hidden"
                    >
                      {/* Priority indicator and type icon */}
                      <box width={3}>
                        <text fg={PRIORITY_COLORS[task.priority]}>
                          {TASK_TYPE_ICONS[task.type]}
                        </text>
                      </box>

                      {/* Task content */}
                      <box flexDirection="column" flexGrow={1} overflow="hidden">
                        {/* Title */}
                        <text fg={colors.text.primary}>
                          {truncate(task.title, 28)}
                        </text>
                        {/* Session info */}
                        <text fg={colors.text.muted}>
                          {truncate(task.sessionName, 18)}
                          {task.issueNumber ? ` #${task.issueNumber}` : ""}
                        </text>
                      </box>

                      {/* Time */}
                      <box width={8} justifyContent="flex-end">
                        <text fg={colors.text.muted}>
                          {formatRelativeTime(new Date(task.createdAt))}
                        </text>
                      </box>
                    </box>
                  )
                }}
              </For>
            </Show>
          </box>

          {/* Separator */}
          <box
            width={1}
            flexDirection="column"
            alignItems="center"
          >
            <For each={Array.from({ length: listHeight })}>
              {() => <text fg={colors.border.primary}>│</text>}
            </For>
          </box>

          {/* Detail panel */}
          <box
            flexDirection="column"
            flexGrow={1}
            paddingLeft={1}
            paddingRight={1}
          >
            <Show
              when={selectedTask()}
              fallback={
                <box flexGrow={1} justifyContent="center" alignItems="center">
                  <text fg={colors.text.muted}>Select a task</text>
                </box>
              }
            >
              {(task) => (
                <>
                  {/* Type badge */}
                  <box height={1}>
                    <text fg={colors.accent.primary} attributes={BOLD}>
                      {TASK_TYPE_NAMES[task().type]}
                    </text>
                  </box>

                  {/* Priority */}
                  <box height={1}>
                    <text fg={colors.text.secondary}>Priority: </text>
                    <text fg={PRIORITY_COLORS[task().priority]}>
                      {task().priority.toUpperCase()}
                    </text>
                  </box>

                  {/* Session */}
                  <box height={1}>
                    <text fg={colors.text.secondary}>Session: </text>
                    <text fg={colors.text.primary}>
                      {truncate(task().sessionName, 18)}
                    </text>
                  </box>

                  {/* Context or raw output */}
                  <Show when={task().context || task().rawOutput}>
                    <box height={1} marginTop={1}>
                      <text fg={colors.text.secondary} attributes={BOLD}>
                        Details:
                      </text>
                    </box>
                    <box flexGrow={1}>
                      <text fg={colors.text.muted}>
                        {truncate(task().context || task().rawOutput || "", 150)}
                      </text>
                    </box>
                  </Show>
                </>
              )}
            </Show>
          </box>
        </box>

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
        >
          <text fg={colors.text.muted}>
            j/k navigate | Enter jump to session | Esc close
          </text>
        </box>
      </box>
    </box>
  )
}
