/**
 * StatusBar component - displays header and footer bars
 *
 * Two variants:
 * - header: "OpenSWE | repo/name | [task badge] | [Backend]"
 * - footer: Keybinding hints
 */

import { Show, For } from "solid-js"
import type { StatusBarProps } from "./types"
import { Footer } from "./Footer"
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
  const actions = [
    { key: keybindings.navigate, label: "Navigate" },
    { key: keybindings.newSession, label: "New" },
    { key: keybindings.tasks, label: "Tasks" },
    { key: keybindings.issues, label: "Issues" },
    { key: keybindings.help, label: "Help" },
    { key: keybindings.quit, label: "Quit" },
  ]

  return <Footer actions={actions} />
}
