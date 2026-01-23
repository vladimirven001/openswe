/**
 * Preview component - right pane showing session output
 *
 * Layout:
 * - Header: Session name + PhaseProgress (full variant)
 * - Separator
 * - Scrollbox with output lines
 */

import { Show, For } from "solid-js"
import type { PreviewProps } from "./types"
import { PhaseProgress } from "./PhaseProgress"
import { colors } from "./theme"

// Bold attribute constant
const BOLD = 1

export function Preview(props: PreviewProps) {
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
            >
              <box flexDirection="column">
                <text fg={colors.text.primary} attributes={BOLD}>
                  {session().name}
                </text>
                <Show when={session().issueNumber}>
                  <text fg={colors.text.secondary}>
                    Issue #{session().issueNumber}
                  </text>
                </Show>
              </box>
              <PhaseProgress phase={session().phase} variant="full" />
            </box>

            {/* Separator */}
            <box width="100%" paddingLeft={1} paddingRight={1}>
              <text fg={colors.border.secondary}>
                {"─".repeat(50)}
              </text>
            </box>

            {/* Output content */}
            <Show
              when={props.lines.length > 0}
              fallback={<NoOutputState />}
            >
              <scrollbox
                flexDirection="column"
                width="100%"
                flexGrow={1}
                paddingLeft={1}
                paddingRight={1}
                stickyScroll
                stickyStart="bottom"
              >
                <For each={props.lines}>
                  {(line) => (
                    <text fg={colors.text.primary}>{line || " "}</text>
                  )}
                </For>
              </scrollbox>
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
        Select a session to view its output
      </text>
    </box>
  )
}

function NoOutputState() {
  return (
    <box
      flexDirection="column"
      width="100%"
      flexGrow={1}
      justifyContent="center"
      alignItems="center"
    >
      <text fg={colors.text.muted}>No output yet</text>
    </box>
  )
}
