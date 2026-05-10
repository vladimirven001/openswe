import { For, Show } from "solid-js"
import { useColors } from "./theme"

export interface FooterAction {
  key: string
  label: string
}

export interface FooterProps {
  actions: FooterAction[]
  message?: string
  bgColor?: string
}

const BOLD = 1
export const FOOTER_HEIGHT = 1

export function Footer(props: FooterProps) {
  const colors = useColors()
  return (
    <box
      flexDirection="row"
      width="100%"
      height={FOOTER_HEIGHT}
      backgroundColor={props.bgColor || colors().bg.secondary}
      paddingLeft={1}
      paddingRight={1}
      justifyContent="space-between"
      alignItems="center"
    >
      {/* Actions (Left) */}
      <box flexDirection="row" gap={2}>
        <For each={props.actions}>
          {(action) => (
            <box flexDirection="row" gap={1}>
              <text fg={colors().accent.primary} attributes={BOLD}>
                {action.key}
              </text>
              <text fg={colors().text.secondary}>{action.label}</text>
            </box>
          )}
        </For>
      </box>

      {/* Message (Right) */}
      <Show when={props.message}>
        <text fg={colors().text.muted}>{props.message}</text>
      </Show>
    </box>
  )
}
