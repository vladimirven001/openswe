/**
 * StatusBar component - displays header and footer bars
 *
 * Two variants:
 * - header: "OpenSWE | repo/name | [task badge] | [Backend]"
 * - footer: Keybinding hints
 */

import { Show, For } from "solid-js"
import type { StatusBarProps } from "./types"
import { colors, keybindings } from "./theme"

// Bold attribute constant (bit 0 in text attributes)
const BOLD = 1

export function StatusBar(props: StatusBarProps) {
  return (
    <Show when={props.variant === "header"} fallback={<FooterBar />}>
      <HeaderBar
        repoName={props.repoName}
        taskCount={props.taskCount}
        backend={props.backend}
      />
    </Show>
  )
}

function HeaderBar(props: {
  repoName?: string
  taskCount?: number
  backend?: string
}) {
  const taskBadge = () => {
    const count = props.taskCount ?? 0
    if (count === 0) return null
    return `[${count} task${count === 1 ? "" : "s"}]`
  }

  return (
    <box
      flexDirection="row"
      width="100%"
      height={1}
      backgroundColor={colors.accent.primary}
      paddingLeft={1}
      paddingRight={1}
      justifyContent="space-between"
    >
      <box flexDirection="row" gap={1}>
        <text fg={colors.text.inverse} attributes={BOLD}>
          OpenSWE
        </text>
        <Show when={props.repoName}>
          <text fg={colors.text.inverse}>|</text>
          <text fg={colors.text.inverse}>{props.repoName}</text>
        </Show>
        <Show when={taskBadge()}>
          <text fg={colors.text.inverse}>|</text>
          <text fg={colors.accent.warning} attributes={BOLD}>
            {taskBadge()}
          </text>
        </Show>
      </box>
      <box flexDirection="row" gap={1}>
        <Show when={props.backend}>
          <text fg={colors.text.inverse}>[{props.backend}]</text>
        </Show>
      </box>
    </box>
  )
}

function FooterBar() {
  const hints = [
    { key: keybindings.navigate, action: "Navigate" },
    { key: keybindings.newSession, action: "New" },
    { key: keybindings.tasks, action: "Tasks" },
    { key: keybindings.issues, action: "Issues" },
    { key: keybindings.help, action: "Help" },
    { key: keybindings.quit, action: "Quit" },
  ]

  return (
    <box
      flexDirection="row"
      width="100%"
      height={1}
      backgroundColor={colors.bg.secondary}
      paddingLeft={1}
      paddingRight={1}
      gap={2}
    >
      <For each={hints}>
        {(hint) => (
          <box flexDirection="row" gap={1}>
            <text fg={colors.accent.primary} attributes={BOLD}>
              {hint.key}
            </text>
            <text fg={colors.text.secondary}>{hint.action}</text>
          </box>
        )}
      </For>
    </box>
  )
}
