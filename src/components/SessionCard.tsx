/**
 * SessionCard component - displays a single session in the list
 *
 * Layout (1 line):
 * - Status icon + session name + spacer + phase indicator
 */

import type { SessionCardProps } from "./types"
import { STATUS_ICONS } from "./types"
import { PhaseProgress } from "./PhaseProgress"
import { colors, typography } from "./theme"
import { truncate } from "../utils/format"

// Bold attribute constant
const BOLD = 1

export function SessionCard(props: SessionCardProps) {
  const statusIcon = () => STATUS_ICONS[props.session.status]
  const statusColor = () => colors.status[props.session.status]

  // Reduced length to accommodate phase on same line
  const truncatedName = () =>
    truncate(props.session.name, typography.maxSessionNameLength - 10)

  return (
    <box
      flexDirection="row"
      width="100%"
      paddingLeft={1}
      paddingRight={1}
      paddingTop={0}
      paddingBottom={0}
      backgroundColor={
        props.isSelected ? colors.bg.cardSelected : colors.bg.card
      }
      borderStyle={props.isSelected ? "rounded" : "single"}
      borderColor={props.isSelected ? colors.accent.primary : colors.border.primary}
      overflow="hidden"
      justifyContent="space-between"
      alignItems="center"
    >
      {/* Left: Status + Name */}
      <box flexDirection="row" gap={1} overflow="hidden" flexShrink={1}>
        <text fg={statusColor()} attributes={BOLD}>
          {statusIcon()}
        </text>
        <text fg={colors.text.primary} attributes={props.isSelected ? BOLD : 0}>
          {truncatedName()}
        </text>
      </box>

      {/* Right: Phase */}
      <box flexShrink={0} paddingLeft={1}>
        <PhaseProgress phase={props.session.phase} variant="inline" />
      </box>
    </box>
  )
}
