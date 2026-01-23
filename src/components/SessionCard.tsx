/**
 * SessionCard component - displays a single session in the list
 *
 * Layout (4 lines):
 * - Line 1: Status icon + session name
 * - Line 2: Issue # + phase indicator
 * - Line 3: Token count
 */

import type { SessionCardProps } from "./types"
import { STATUS_ICONS } from "./types"
import { PhaseProgress } from "./PhaseProgress"
import { colors, typography } from "./theme"
import { truncate, formatTokens } from "../utils/format"

// Bold attribute constant
const BOLD = 1

export function SessionCard(props: SessionCardProps) {
  const statusIcon = () => STATUS_ICONS[props.session.status]
  const statusColor = () => colors.status[props.session.status]

  const truncatedName = () =>
    truncate(props.session.name, typography.maxSessionNameLength)

  const issueLabel = () => {
    if (props.session.issueNumber) {
      return `#${props.session.issueNumber}`
    }
    return "No issue"
  }

  const tokenDisplay = () => formatTokens(props.session.tokensUsed)

  return (
    <box
      flexDirection="column"
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
    >
      {/* Line 1: Status icon + name */}
      <box flexDirection="row" gap={1} overflow="hidden">
        <text fg={statusColor()} attributes={BOLD}>
          {statusIcon()}
        </text>
        <text fg={colors.text.primary} attributes={props.isSelected ? BOLD : 0}>
          {truncatedName()}
        </text>
      </box>

      {/* Line 2: Issue # + phase */}
      <box flexDirection="row" gap={1} justifyContent="space-between" overflow="hidden">
        <box width={10}>
          <text fg={colors.text.secondary}>{issueLabel()}</text>
        </box>
        <PhaseProgress phase={props.session.phase} variant="inline" />
      </box>

      {/* Line 3: Token count */}
      <box flexDirection="row" gap={1}>
        <text fg={colors.text.muted}>Tokens:</text>
        <text fg={colors.text.secondary}>{tokenDisplay()}</text>
      </box>
    </box>
  )
}
