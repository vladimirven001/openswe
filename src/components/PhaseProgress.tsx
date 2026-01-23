/**
 * PhaseProgress component - displays workflow phase progress
 *
 * Two variants:
 * - inline: Just the phase name text (for session cards)
 * - full: Progress bar + phase name (for preview pane)
 */

import { Show } from "solid-js"
import type { PhaseProgressProps } from "./types"
import {
  PHASE_DISPLAY_NAMES,
  getPhaseProgress,
  generateProgressBar,
} from "./types"
import { colors } from "./theme"

export function PhaseProgress(props: PhaseProgressProps) {
  const displayName = () => PHASE_DISPLAY_NAMES[props.phase]
  const progress = () => getPhaseProgress(props.phase)
  const progressBar = () => generateProgressBar(progress(), 10)

  // Color based on phase
  const phaseColor = () => {
    if (props.phase === "completed") return colors.accent.success
    if (props.phase === "failed") return colors.accent.error
    return colors.progress.text
  }

  return (
    <Show
      when={props.variant === "full"}
      fallback={
        <text fg={phaseColor()}>{displayName()}</text>
      }
    >
      <box flexDirection="row" gap={1}>
        <text fg={colors.progress.filled}>{progressBar()}</text>
        <text fg={phaseColor()}>{displayName()}</text>
        <text fg={colors.text.muted}>({progress()}%)</text>
      </box>
    </Show>
  )
}
