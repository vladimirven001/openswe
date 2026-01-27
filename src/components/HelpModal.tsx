/**
 * HelpModal component - Displays keybinding help overlay
 *
 * Shows all available keyboard shortcuts organized by category.
 */

import { For } from "solid-js"
import type { HelpModalProps } from "./types"
import { Footer } from "./Footer"
import { colors } from "./theme"
import { useKeyboard } from "@opentui/solid"

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
      { key: "t", description: "Change theme" },
      { key: "a", description: "AI Provider" },
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

  useKeyboard((event) => {
    switch (event.name) {
        case "escape":
        props.onClose()
        break
	}
  })



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
            Help
          </text>
        </box>

        {/* Content */}
        <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} >
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
                    <box flexDirection="row" paddingLeft={2}>
                      {/* Fixed width box for key to ensure alignment */}
                      <box width={14}>
                        <text fg={colors.text.primary}>
                          {binding.key}
                        </text>
                      </box>
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
        <Footer actions={[{ key: "Esc", label: "Exit" }]} bgColor={colors.bg.primary} />
      </box>
    </box>
  )
}
