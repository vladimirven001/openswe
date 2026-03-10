/**
 * StatusBar component - displays header and footer bars
 *
 * Two variants:
 * - header: "openswe | repo/name | [task badge] | [Backend]"
 * - footer: Keybinding hints
 */

import { Show, For } from "solid-js"
import type { StatusBarProps } from "./types"
import type { ProviderBranding } from "../providers"
import { Footer } from "./Footer"
import { useColors, keybindings } from "./theme"

// Bold attribute constant (bit 0 in text attributes)
const BOLD = 1

export function StatusBar(props: StatusBarProps) {
  return (
    <Show when={props.variant === "header"} fallback={<FooterBar />}>
      <HeaderBar
        repoName={props.repoName}
        backend={props.backend}
        sessionId={props.sessionId}
        worktreeCommand={props.worktreeCommand}
        worktreeIcon={props.worktreeIcon}
        onWorktreeClick={props.onWorktreeClick}
        providerBranding={props.providerBranding}
      />
    </Show>
  )
}

function HeaderBar(props: {
  repoName?: string
  backend?: string
  sessionId?: string
  worktreeCommand?: string
  worktreeIcon?: "default" | "success" | "error"
  onWorktreeClick?: () => void
  providerBranding?: ProviderBranding
}) {
  const colors = useColors()
  const headerBg = () => props.providerBranding?.headerBackground ?? props.providerBranding?.accentColor ?? colors().accent.primary
  const backendDisplay = () => props.providerBranding?.displayName ?? props.backend

  const iconPrefix = () => {
    switch (props.worktreeIcon) {
      case "success":
        return "✓ "
      case "error":
        return "✗ "
      default:
        return ""
    }
  }

  return (
    <box
      flexDirection="row"
      width="100%"
      height={1}
      backgroundColor={headerBg()}
      paddingLeft={1}
      paddingRight={1}
      justifyContent="space-between"
    >
      <box flexDirection="row" gap={1}>
        <text fg={colors().text.inverse} attributes={BOLD}>
          openswe
        </text>
        <Show when={props.repoName}>
          <text fg={colors().text.inverse}>|</text>
          <text fg={colors().text.inverse}>{props.repoName}</text>
        </Show>
      </box>

      {/* Center: Worktree command */}
      <box flexDirection="row" gap={1}>
        <Show when={props.worktreeCommand}>
          <box
            onMouseDown={() => props.onWorktreeClick?.()}
          >
            <text fg={colors().text.inverse} opacity={0.8} selectable={false}>
              {iconPrefix()}{props.worktreeCommand}
            </text>
          </box>
        </Show>
      </box>

      <box flexDirection="row" gap={1}>
        <Show when={props.sessionId}>
          <text fg={colors().text.inverse}>ID: {props.sessionId}</text>
        </Show>
        <Show when={backendDisplay()}>
          <text fg={colors().text.inverse}>[{backendDisplay()}]</text>
        </Show>
      </box>
    </box>
  )
}

function FooterBar() {
  const actions = [
    { key: keybindings.navigate, label: "Navigate" },
    { key: keybindings.newSession, label: "New" },
    { key: keybindings.issues, label: "Issues" },
    { key: "a", label: "AI" },
    { key: keybindings.theme, label: "Theme" },
    { key: keybindings.help, label: "Help" },
    { key: keybindings.quit, label: "Quit" },
  ]

  return <Footer actions={actions} />
}
