/**
 * ManualSessionModal component - Create a new manual session
 *
 * Collects a session name and creates a worktree + session entry.
 */

import { createSignal, createEffect, onCleanup, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { ManualSessionModalProps } from "./types"
import { createManualSession } from "./session-utils"
import { Footer } from "./Footer"
import { colors } from "./theme"
import { logger } from "../utils/logger"

// Bold attribute constant
const BOLD = 1
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export function ManualSessionModal(props: ManualSessionModalProps) {
  const modalWidth = 50
  const maxNameLength = 40

  const [name, setName] = createSignal("")
  const [error, setError] = createSignal<string | null>(null)
  const [creating, setCreating] = createSignal(false)
  const [spinnerFrame, setSpinnerFrame] = createSignal(0)

  // Spinner animation
  createEffect(() => {
    if (creating()) {
      const interval = setInterval(() => {
        setSpinnerFrame((prev) => (prev + 1) % SPINNER_FRAMES.length)
      }, 80)
      onCleanup(() => clearInterval(interval))
    }
  })

  // Dynamic height based on error/creating state
  const modalHeight = () => {
    let height = 8 // Base: header(1) + label(1) + input(1) + footer(1) + borders(2) + padding(2)
    if (error()) height += 1
    if (creating()) height += 1
    return height
  }

  const appendChar = (char: string) => {
    setName((prev) => {
      if (prev.length >= maxNameLength) return prev
      return prev + char
    })
  }

  const handleSubmit = async () => {
    const trimmed = name().trim()
    if (!trimmed) {
      setError("Session name is required")
      return
    }

    setCreating(true)
    setError(null)
    logger.debug("Creating manual session", { name: trimmed })

    const result = await createManualSession(props.projectRoot, trimmed, {
      aiSessionData: { backend: props.currentBackend }
    })

    if (result.success) {
      logger.debug("Manual session created", { sessionId: result.session?.id })
      props.onSessionCreated()
      props.onClose()
    } else {
      const message = result.error ?? "Failed to create session"
      logger.warn("Manual session creation failed", message)
      setError(message)
    }

    setCreating(false)
  }

  const extractChar = (event: { name?: string; sequence?: string }) => {
    if (event.sequence && event.sequence.length === 1) {
      return event.sequence
    }
    if (event.name === "space") return " "
    if (event.name && event.name.length === 1) return event.name
    return null
  }

  useKeyboard((event) => {
    if (creating()) return

    switch (event.name) {
      case "escape":
        props.onClose()
        return
      case "backspace":
        setName((prev) => prev.slice(0, -1))
        return
      case "return":
        handleSubmit()
        return
    }

    const char = extractChar(event)
    if (char) {
      appendChar(char)
      setError(null)
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
      <box
        flexDirection="column"
        width={modalWidth}
        height={modalHeight()}
        backgroundColor={colors.bg.secondary}
        borderStyle="rounded"
        borderColor={colors.border.accent}
        overflow="hidden"
      >
        {/* Header */}
        <box height={1} justifyContent="center" paddingLeft={1} paddingRight={1}>
          <text fg={colors.text.primary} attributes={BOLD}>
            New Manual Session
          </text>
        </box>

        {/* Content area */}
        <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
          <box height={1}>
            <text fg={colors.text.secondary}>Name:</text>
          </box>

          <box height={1}>
            <text fg={colors.text.primary}>
              {name() || "Type a session name"}
            </text>
          </box>

          <Show when={error()}>
            <box height={1}>
              <text fg={colors.accent.error}>{error()}</text>
            </box>
          </Show>

          <Show when={creating()}>
            <box height={1} justifyContent="center">
              <text fg={colors.accent.primary}>
                {SPINNER_FRAMES[spinnerFrame()]} Creating session...
              </text>
            </box>
          </Show>
        </box>

        {/* Footer */}
        <Footer
          actions={[
            { key: "Enter", label: "Create" },
            { key: "Esc", label: "Cancel" },
          ]}
          bgColor={colors.bg.primary}
        />
      </box>
    </box>
  )
}
