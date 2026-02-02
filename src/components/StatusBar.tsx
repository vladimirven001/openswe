/**
 * StatusBar component - displays header and footer bars
 *
 * Two variants:
 * - header: "OpenSWE | repo/name | [task badge] | [Backend]"
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
        providerBranding={props.providerBranding}
      />
    </Show>
  )
}

function HeaderBar(props: {
  repoName?: string
  backend?: string
  sessionId?: string
  providerBranding?: ProviderBranding
}) {
  const colors = useColors()
  const headerBg = () => props.providerBranding?.headerBackground ?? props.providerBranding?.accentColor ?? colors().accent.primary
  const backendDisplay = () => props.providerBranding?.displayName ?? props.backend

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
          OpenSWE
        </text>
        <Show when={props.repoName}>
          <text fg={colors().text.inverse}>|</text>
          <text fg={colors().text.inverse}>{props.repoName}</text>
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
