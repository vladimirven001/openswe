/**
 * HelpModal component - Displays keybinding help overlay
 *
 * Shows all available keyboard shortcuts organized by category.
 */

import { For } from "solid-js"
import type { HelpModalProps } from "./types"
import { colors } from "./theme"

// Bold attribute constant
const BOLD = 1

/** Keybinding section for display */
interface KeySection {
  title: string
  bindings: Array<{ key: string; description: string }>
}

const KEY_SECTIONS: KeySection[] = [
  {
    title: "Navigation",
    bindings: [
      { key: "j / \u2193", description: "Move down" },
      { key: "k / \u2191", description: "Move up" },
      { key: "Enter", description: "Open session details" },
    ],
  },
  {
    title: "Sessions",
    bindings: [
      { key: "n", description: "New session" },
      { key: "d", description: "Delete session" },
      { key: "p", description: "Pause/resume session" },
      { key: "r", description: "Refresh data" },
    ],
  },
  {
    title: "Modals",
    bindings: [
      { key: "t", description: "Task queue" },
      { key: "i", description: "Issue selector" },
      { key: "?", description: "This help" },
      { key: "Esc", description: "Close modal" },
    ],
  },
  {
    title: "Application",
    bindings: [{ key: "q", description: "Quit" }],
  },
]

export function HelpModal(props: HelpModalProps) {
  const modalWidth = 44
  const modalHeight = 24

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
        <box
          height={1}
          justifyContent="center"
          paddingLeft={1}
          paddingRight={1}
        >
          <text fg={colors.text.primary} attributes={BOLD}>
            Help
          </text>
        </box>

        {/* Content */}
        <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2}>
          <For each={KEY_SECTIONS}>
            {(section) => (
              <box flexDirection="column" paddingTop={1}>
                {/* Section title */}
                <text fg={colors.accent.primary} attributes={BOLD}>
                  {section.title}
                </text>
                {/* Keybindings */}
                <For each={section.bindings}>
                  {(binding) => (
                    <box flexDirection="row" gap={1} paddingLeft={2}>
                      <text fg={colors.text.primary}>
                        {binding.key.padEnd(12)}
                      </text>
                      <text fg={colors.text.secondary}>
                        {binding.description}
                      </text>
                    </box>
                  )}
                </For>
              </box>
            )}
          </For>
        </box>

        {/* Footer */}
        <box
          height={1}
          justifyContent="center"
          borderStyle="single"
          borderColor={colors.border.primary}
        >
          <text fg={colors.text.muted}>Press Esc to close</text>
        </box>
      </box>
    </box>
  )
}
