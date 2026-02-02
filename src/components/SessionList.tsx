/**
 * SessionList component - left pane with scrollable session list
 *
 * Displays a list of SessionCards with:
 * - Title showing total and active session counts
 * - Empty state when no sessions exist
 * - Scrollbox for overflow
 */

import { Show, For } from "solid-js"
import type { SessionListProps } from "./types"
import { SessionCard } from "./SessionCard"
import { useColors } from "./theme"

export function SessionList(props: SessionListProps) {
  const colors = useColors()
  const totalCount = () => props.sessions.length
  const activeCount = () =>
    props.sessions.filter((s) => s.status === "active").length

  const title = () => ` Sessions (${activeCount()}/${totalCount()} active) `

  return (
    <box
      flexDirection="column"
      width="30%"
      height="100%"
      borderStyle="rounded"
      borderColor={colors().border.primary}
      title={title()}
    >
      <Show
        when={props.sessions.length > 0}
        fallback={<EmptyState />}
      >
        <scrollbox
          flexDirection="column"
          width="100%"
          height="100%"
          gap={1}
          paddingTop={1}
          paddingBottom={1}
        >
          <For each={props.sessions}>
            {(session, index) => (
              <SessionCard
                session={session}
                isSelected={index() === props.selectedIndex}
                availableWidth={props.listWidth - 4}
              />
            )}
          </For>
        </scrollbox>
      </Show>
    </box>
  )
}

function EmptyState() {
  const colors = useColors()
  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      gap={1}
    >
      <text fg={colors().text.muted}>No sessions yet</text>
      <text fg={colors().text.secondary}>
        Press 'n' to create a new session
      </text>
      <text fg={colors().text.secondary}>
        or 'i' to browse issues
      </text>
    </box>
  )
}
