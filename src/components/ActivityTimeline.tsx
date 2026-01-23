/**
 * ActivityTimeline component
 *
 * Displays a timeline of activity events for the session preview.
 * Shows icons, titles, and relative timestamps for recent activities.
 */

import { Show, For, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import type { ActivityEvent } from "./types"
import { colors } from "./theme"

// ============================================================================
// Props
// ============================================================================

export interface ActivityTimelineProps {
  activities: ActivityEvent[]
  maxItems?: number
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a relative time string (e.g., "2s ago", "5m ago")
 */
function formatRelativeTime(timestamp: Date, now: number): string {
  const diff = now - timestamp.getTime()

  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/**
 * Get color based on activity type
 */
function getActivityColor(type: ActivityEvent["type"]): string {
  switch (type) {
    case "error":
      return colors.accent.error
    case "question":
      return colors.accent.warning
    case "phase":
      return colors.accent.info
    case "session_start":
      return colors.accent.primary
    case "test":
      return colors.accent.success
    case "git":
      return colors.accent.secondary
    default:
      return colors.text.secondary
  }
}

// ============================================================================
// Components
// ============================================================================

function ActivityItem(props: { activity: ActivityEvent; now: number }) {
  const relativeTime = createMemo(() => formatRelativeTime(props.activity.timestamp, props.now))
  const activityColor = createMemo(() => getActivityColor(props.activity.type))

  return (
    <box
      flexDirection="row"
      width="100%"
      justifyContent="space-between"
      alignItems="center"
      paddingLeft={1}
      paddingRight={1}
    >
      <box flexDirection="row" gap={1} overflow="hidden" flexShrink={1}>
        <text fg={activityColor()}>{props.activity.icon}</text>
        <text fg={colors.text.primary}>{props.activity.title}</text>
      </box>
      <text fg={colors.text.muted}>{relativeTime()}</text>
    </box>
  )
}

function EmptyState() {
  return (
    <box
      flexDirection="column"
      width="100%"
      flexGrow={1}
      justifyContent="center"
      alignItems="center"
      gap={1}
    >
      <text fg={colors.text.muted}>No activity yet</text>
      <text fg={colors.text.secondary}>
        Activity will appear here as the session progresses
      </text>
    </box>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ActivityTimeline(props: ActivityTimelineProps) {
  const [now, setNow] = createSignal(Date.now())

  onMount(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    onCleanup(() => clearInterval(interval))
  })

  const displayActivities = createMemo(() => {
    const max = props.maxItems ?? 15
    return props.activities.slice(0, max)
  })

  return (
    <box
      flexDirection="column"
      width="100%"
      flexGrow={1}
      paddingTop={1}
    >
      {/* Section header */}
      <box paddingLeft={1} paddingBottom={1}>
        <text fg={colors.text.secondary}>Activity Timeline</text>
      </box>

      {/* Activity list or empty state */}
      <Show
        when={displayActivities().length > 0}
        fallback={<EmptyState />}
      >
        <scrollbox
          flexDirection="column"
          width="100%"
          flexGrow={1}
          gap={0}
        >
          <For each={displayActivities()}>
            {(activity) => <ActivityItem activity={activity} now={now()} />}
          </For>
        </scrollbox>
      </Show>
    </box>
  )
}
