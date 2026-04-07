/**
 * SessionCard component - displays a single session in the list
 *
 * Layout (1 line):
 * - Status icon + session name
 */

import type { SessionCardProps } from "./types"
import { STATUS_ICONS } from "./types"
import { ScrollableText } from "./ScrollableText"
import { useColors } from "./theme"

// Bold attribute constant
const BOLD = 1

export function SessionCard(props: SessionCardProps) {
  const colors = useColors()
  const statusIcon = () => STATUS_ICONS[props.session.status]
  const statusColor = () => colors().status[props.session.status]
  
  // Calculate width for the name scrolling area
  // availableWidth is total inner width of the card
  // Subtract: 
  // - Padding (L+R): 2
  // - Status Icon + Gap: 2
  const nameWidth = () => Math.max(10, props.availableWidth - 4)

  return (
    <box
      flexDirection="row"
      width="100%"
      paddingLeft={1}
      paddingRight={1}
      paddingTop={0}
      paddingBottom={0}
      backgroundColor={
        props.isSelected ? colors().selection.background : colors().bg.card
      }
      borderStyle={props.isSelected ? "rounded" : "single"}
      borderColor={props.isSelected ? colors().accent.primary : colors().border.primary}
      overflow="hidden"
      justifyContent="space-between"
      alignItems="center"
    >
      {/* Left: Status + Name */}
      <box flexDirection="row" gap={1} overflow="hidden" flexShrink={1}>
        <text fg={statusColor()} attributes={BOLD}>
          {statusIcon()}
        </text>
        <ScrollableText
          text={props.session.name}
          width={nameWidth()}
          isActive={props.isSelected}
          fg={colors().text.primary}
          attributes={props.isSelected ? BOLD : 0}
        />
      </box>
    </box>
  )
}
