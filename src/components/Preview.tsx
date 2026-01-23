/**
 * Preview component - right pane showing session activity timeline
 *
 * Layout:
 * - Header: Session name + PhaseProgress (full variant)
 * - Separator
 * - Activity Timeline showing recent events
 * - Footer: Session duration + attach hint
 */

import { Show, createMemo } from "solid-js"
import type { PreviewProps } from "./types"
import type { Session } from "../store"
import { getUnresolvedTasksBySession } from "../store"
import { PhaseProgress } from "./PhaseProgress"
import { ActivityTimeline } from "./ActivityTimeline"
import { colors } from "./theme"
import { truncate } from "../utils/format"

// Bold attribute constant
const BOLD = 1

/**
 * Format duration in human-readable form
 */
function formatDuration(startedAt: Date | undefined): string {
  if (!startedAt) return ""

  const diff = Date.now() - startedAt.getTime()
  const seconds = Math.floor(diff / 1000)

  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return `${hours}h ${remainingMinutes}m`
}

/**
 * StatusBanner component - shows attention status with icon
 * Displays colored banner when session needs attention due to questions/errors
 */
function StatusBanner(props: { session: Session }) {
  const bannerInfo = createMemo(() => {
    const tasks = getUnresolvedTasksBySession(props.session.id)
    const hasQuestion = tasks.some(t => t.type === "question")
    const hasError = tasks.some(t => t.type === "blocker" || t.type === "retry_failed")

    if (hasError) {
      return {
        icon: "X",
        text: "Error - needs attention",
        color: colors.accent.error,
        bgColor: colors.accent.error,
      }
    }
    if (hasQuestion) {
      return {
        icon: "?",
        text: "Question pending",
        color: colors.accent.warning,
        bgColor: colors.accent.warning,
      }
    }
    // General needs_attention (e.g., push failed)
    return {
      icon: "!",
      text: props.session.attentionReason || "Needs attention",
      color: colors.accent.warning,
      bgColor: colors.accent.warning,
    }
  })

  return (
    <box
      width="100%"
      paddingLeft={1}
      paddingRight={1}
      paddingTop={0}
      paddingBottom={0}
    >
      <box
        flexDirection="row"
        gap={1}
        alignItems="center"
      >
        <text fg={bannerInfo().color}>{bannerInfo().icon}</text>
        <text fg={bannerInfo().color}>{bannerInfo().text}</text>
      </box>
    </box>
  )
}

export function Preview(props: PreviewProps) {
  const duration = createMemo(() => formatDuration(props.startedAt))
  const isActive = createMemo(() => props.session?.status === "active")

  return (
    <box
      flexDirection="column"
      width="70%"
      height="100%"
      borderStyle="rounded"
      borderColor={colors.border.primary}
      title="Preview"
    >
      <Show
        when={props.session}
        fallback={<NoSelectionState />}
      >
        {(session) => (
          <>
            {/* Header with session info */}
            <box
              flexDirection="row"
              width="100%"
              paddingLeft={1}
              paddingRight={1}
              paddingTop={1}
              justifyContent="space-between"
              alignItems="center"
              overflow="hidden"
            >
              <box flexDirection="column" overflow="hidden">
                <text fg={colors.text.primary} attributes={BOLD}>
                  {truncate(session().name, 40)}
                </text>
                <Show when={session().issueNumber}>
                  <text fg={colors.text.secondary}>
                    Issue #{session().issueNumber}
                  </text>
                </Show>
              </box>
              <PhaseProgress phase={session().phase} variant="full" />
            </box>

            {/* Status Banner for needs_attention */}
            <Show when={session().status === "needs_attention"}>
              <StatusBanner session={session()} />
            </Show>

            {/* Separator */}
            <box width="100%" height={1} paddingLeft={1} paddingRight={1} overflow="hidden">
              <text fg={colors.border.secondary}>
                {"─".repeat(100)}
              </text>
            </box>

            {/* Activity Timeline */}
            <ActivityTimeline
              activities={props.activities}
              maxItems={15}
            />

            {/* Footer */}
            <Show when={isActive()}>
              <box
                width="100%"
                height={1}
                paddingLeft={1}
                paddingRight={1}
                overflow="hidden"
              >
                <text fg={colors.border.secondary}>
                  {"─".repeat(100)}
                </text>
              </box>
              <box
                flexDirection="row"
                width="100%"
                paddingLeft={1}
                paddingRight={1}
                paddingBottom={1}
                justifyContent="space-between"
                alignItems="center"
              >
                <Show when={duration()}>
                  <text fg={colors.text.muted}>
                    Running for {duration()}
                  </text>
                </Show>
                <text fg={colors.text.secondary}>
                  Press Enter to attach
                </text>
              </box>
            </Show>
          </>
        )}
      </Show>
    </box>
  )
}

function NoSelectionState() {
  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      gap={1}
    >
      <text fg={colors.text.muted}>No session selected</text>
      <text fg={colors.text.secondary}>
        Select a session to view its activity
      </text>
    </box>
  )
}
