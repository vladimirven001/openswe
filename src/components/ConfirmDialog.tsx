/**
 * ConfirmDialog component - Reusable confirmation dialog
 *
 * Used for destructive actions like deleting sessions.
 */

import { For } from "solid-js"
import { Footer } from "./Footer"
import type { ConfirmDialogProps } from "./types"
import { colors } from "./theme"

// Bold attribute constant
const BOLD = 1

export function ConfirmDialog(props: ConfirmDialogProps) {
  const modalWidth = 45

  // Split message into lines
  const messageLines = () => props.message.split("\n")
  // Height: title(1) + message lines + padding(2) + footer(1) + borders(2)
  const modalHeight = () => messageLines().length + 6

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
        height={modalHeight()}
        backgroundColor={colors.bg.secondary}
        borderStyle="rounded"
        borderColor={colors.accent.warning}
        overflow="hidden"
      >
        {/* Header / Title */}
        <box
          height={1}
          justifyContent="center"
          paddingLeft={1}
          paddingRight={1}
        >
          <text fg={colors.accent.warning} attributes={BOLD}>
            {props.title}
          </text>
        </box>

        {/* Message content */}
        <box
          flexDirection="column"
          flexGrow={1}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          justifyContent="center"
        >
          <For each={messageLines()}>
            {(line) => (
              <text fg={colors.text.primary}>{line || " "}</text>
            )}
          </For>
        </box>

        {/* Footer with action hints */}
        <Footer
          actions={[
            { key: "Enter", label: "Confirm" },
            { key: "Esc", label: "Cancel" },
          ]}
          bgColor={colors.bg.primary}
        />
      </box>
    </box>
  )
}
