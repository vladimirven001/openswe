/**
 * Preview component - right pane showing session terminal output
 *
 * Layout:
 * - Header: Session name + PhaseProgress (full variant)
 * - Separator
 * - Terminal Output
 * - Footer: Session duration + attach hint
 */

import { Show, createMemo, For } from "solid-js"
import type { PreviewProps } from "./types"
import type { Session } from "../store"
import { getPhaseProgress } from "./types"
import { useColors, type Colors } from "./theme"
import { Footer } from "./Footer"
import { truncate } from "../utils/format"
import { parseAnsiLine } from "../utils/ansi-parser"
import { getProvider, isProviderSupported } from "../providers"

import { formatTokens } from "../utils/format"

// Bold attribute constant
const BOLD = 1
const VERSION = "v0.1.0" // TODO: Get from package.json or config

/**
 * Format duration in human-readable form
 */
function formatDuration(startedAt: Date | undefined): string {
  if (!startedAt) return ""

  const diff = Date.now() - startedAt.getTime()
  const seconds = Math.floor(diff / 1000)

  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return `${hours}h ${remainingMinutes}m`
}

/**
 * StatusBanner component - shows attention status with icon
 * Displays colored banner when session needs attention due to questions/errors
 */
function StatusBanner(props: { session: Session }) {
  const colors = useColors()
  const bannerInfo = createMemo(() => {
    // General needs_attention (e.g., push failed)
    return {
      icon: "!",
      text: props.session.attentionReason || "Needs attention",
      color: colors().accent.warning,
      bgColor: colors().accent.warning,
    }
  })

  return (
    <box
      width="100%"
      paddingLeft={1}
      paddingRight={1}
      paddingTop={0}
      paddingBottom={0}
    >
      <box
        flexDirection="row"
        gap={1}
        alignItems="center"
      >
        <text fg={bannerInfo().color}>{bannerInfo().icon}</text>
        <text fg={bannerInfo().color}>{bannerInfo().text}</text>
      </box>
    </box>
  )
}

export function Preview(props: PreviewProps) {
  const colors = useColors()
  const duration = createMemo(() => formatDuration(props.startedAt))
  const isActive = createMemo(() => props.session?.status === "active")
  const isPaused = createMemo(() => props.session?.status === "paused")

  // Resolve provider branding from session data if available, otherwise fall back to global prop
  const resolvedBranding = createMemo(() => {
    const sessionBackend = props.session?.aiSessionData?.backend
    if (sessionBackend && isProviderSupported(sessionBackend)) {
      try {
        return getProvider(sessionBackend).branding
      } catch {
        // Fallback if provider lookup fails
      }
    }
    return props.providerBranding
  })

  const borderColor = createMemo(() => resolvedBranding()?.accentColor ?? colors().border.primary)
  const providerName = createMemo(() => resolvedBranding()?.displayName ?? "Terminal")
  const terminalBackground = createMemo(() => resolvedBranding()?.terminalBackground)

  return (
    <box
      flexDirection="column"
      width="70%"
      height="100%"
      borderStyle="rounded"
      borderColor={borderColor()}
      title={` Preview [${providerName()}] `}
    >
      <Show
        when={props.session}
        fallback={<NoSelectionState />}
      >
        {(session) => (
          /* Terminal View - Full Height */
          <box flexDirection="column" width="100%" height="100%">
             {/* Header with session info */}
             <box
                flexDirection="row"
                width="100%"
                paddingLeft={1}
                paddingRight={1}
                paddingTop={0}
                paddingBottom={0}
                justifyContent="space-between"
                alignItems="flex-start"
                overflow="hidden"
              >
                <box flexDirection="column" overflow="hidden" flexGrow={1} marginRight={1}>
                  <text fg={colors().text.primary} attributes={BOLD}>
                    {truncate(session().name, 60)}
                  </text>
                  <Show when={session().issueNumber}>
                    <text fg={colors().text.secondary}>
                      Issue #{session().issueNumber}
                    </text>
                  </Show>
                </box>

                {/* Right side metadata */}
                <box flexDirection="column" alignItems="flex-end" marginRight={1}>
                  <box flexDirection="row" gap={1}>
                    <text fg={colors().text.muted}>
                      {session().tokensUsed ? session().tokensUsed.toLocaleString() : "0"}
                    </text>
                    <text fg={colors().text.muted}>
                      {getPhaseProgress(session().phase)}%
                    </text>
                    <text fg={colors().text.muted}>($0.00)</text>
                    <text fg={colors().text.muted}>{VERSION}</text>
                  </box>
                </box>
              </box>

              {/* Status Banner for needs_attention */}
              <Show when={session().status === "needs_attention"}>
                <StatusBanner session={session()} />
              </Show>

              {/* Separator */}
              <box width="100%" height={1} overflow="hidden">
                <text fg={colors().border.secondary}>
                  {"─".repeat(500)}
                </text>
              </box>

              <box
                flexDirection="column"
                flexGrow={1}
                width="100%"
                paddingLeft={1}
                paddingRight={1}
                paddingTop={0}
                justifyContent="flex-end"
                overflow="hidden"
                backgroundColor={terminalBackground()}
              >
                <Show
                  when={(props.session?.status === "active" || props.session?.status === "paused") && props.snapshotLines && props.snapshotLines.length > 0}
                  fallback={
                    <box height="100%" justifyContent="center" alignItems="center">
                      <text fg={colors().text.muted}>
                        {isPaused() ? "Session paused - press Enter to resume" : "Waiting for output..."}
                      </text>
                    </box>
                  }
                >
                  <For each={props.snapshotLines}>
                    {(line) => {
                      const segments = parseAnsiLine(line)
                      return (
                        <box flexDirection="row">
                          <For each={segments}>
                            {(segment) => (
                              <text
                                fg={segment.fg || colors().text.primary}
                                bg={segment.bg}
                                attributes={segment.bold ? BOLD : undefined}
                              >
                                {segment.text}
                              </text>
                            )}
                          </For>
                        </box>
                      )
                    }}
                  </For>
                </Show>
              </box>

               {/* Footer */}
               <Show when={isActive()}>
                <Footer
                  actions={[
                    { key: "Enter", label: "Attach" },
                    { key: "tmux-prefix+d", label: "Detach" },
                    { key: "p", label: "Pause" }
                  ]}
                  message={duration() ? `Running for ${duration()}` : undefined}
                />
              </Show>
              
              <Show when={isPaused()}>
                <Footer
                  actions={[
                    { key: "Enter", label: "Resume" }
                  ]}
                  message="Session paused - AI process terminated"
                />
              </Show>
          </box>
        )}
      </Show>
    </box>
  )
}

function NoSelectionState() {
  const colors = useColors()
  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      gap={1}
    >
      <text fg={colors().text.muted}>No session selected</text>
      <text fg={colors().text.secondary}>
        Select a session to view terminal output
      </text>
    </box>
  )
}
