/**
 * SessionTerminal component - Full screen interactive terminal view
 */

import { For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { Session } from "../store"
import { useColors } from "./theme"

export interface SessionTerminalProps {
  session: Session
  lines: string[]
  onInput: (data: string) => void
  onExit: () => void
}

export function SessionTerminal(props: SessionTerminalProps) {
  const colors = useColors()

  // Handle keyboard input
  useKeyboard((event) => {
    // Handle exit shortcut (Ctrl+C or Esc)
    if (event.name === "c" && event.ctrl) {
      props.onExit()
      return
    }
    if (event.name === "escape") {
      props.onExit()
      return
    }

    // Map keys to input
    if (event.name === "return") {
      props.onInput("\r")
    } else if (event.name === "backspace") {
      props.onInput("\x7f") // DEL
    } else if (event.name === "tab") {
      props.onInput("\t")
    } else if (event.name === "space") {
      props.onInput(" ")
    } else if (event.name && event.name.length === 1 && !event.ctrl && !event.meta) {
      // Regular characters
      props.onInput(event.name)
    }
  })

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={colors().bg.primary}
    >
      {/* Header */}
      <box
        height={1}
        width="100%"
        backgroundColor={colors().bg.secondary}
        paddingLeft={1}
        paddingRight={1}
        justifyContent="space-between"
      >
        <text fg={colors().text.primary} attributes={1}>
          Terminal: {props.session.name}
        </text>
        <text fg={colors().text.muted}>
          [Esc] Detach
        </text>
      </box>

      {/* Terminal Output */}
      <scrollbox
        flexDirection="column"
        flexGrow={1}
        width="100%"
        paddingLeft={1}
        paddingRight={1}
        stickyScroll
        stickyStart="bottom"
      >
        <For each={props.lines}>
          {(line) => (
            <text fg={colors().text.primary}>{line || " "}</text>
          )}
        </For>
      </scrollbox>
    </box>
  )
}
