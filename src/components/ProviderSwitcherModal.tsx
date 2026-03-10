/**
 * ProviderSwitcherModal component - Allows switching AI backends
 *
 * Displays a list of available AI providers and lets the user select one.
 * Validates installation before allowing selection.
 */

import { createSignal, onMount, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { ProviderSwitcherModalProps } from "./types"
import { getAllProviders, type Provider } from "../providers"
import { Footer } from "./Footer"
import { useColors } from "./theme"

// Bold attribute constant
const BOLD = 1

export function ProviderSwitcherModal(props: ProviderSwitcherModalProps) {
  const colors = useColors()
  const [providers, setProviders] = createSignal<Provider[]>([])
  const [focusedIndex, setFocusedIndex] = createSignal(0)
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null)

  onMount(() => {
    const all = getAllProviders()
    setProviders(all)
    
    // Set initial focus to current backend
    const idx = all.findIndex(p => p.id === props.currentBackend)
    if (idx !== -1) {
      setFocusedIndex(idx)
    }
  })

  const handleSelect = async (provider: Provider) => {
    setErrorMessage(null)
    
    const isInstalled = await provider.validateInstallation()
    if (!isInstalled) {
      const installationUrl = provider.branding.installationUrl
      setErrorMessage(
        installationUrl
          ? `${provider.branding.displayName} is not installed - install from: ${installationUrl}`
          : `${provider.branding.displayName} is not installed`
      )
      return
    }

    props.onSelect(provider.id)
  }

  useKeyboard((event) => {
    const list = providers()
    
    switch (event.name) {
      case "escape":
        props.onClose()
        break
        
      case "j":
      case "down":
        setFocusedIndex(prev => 
          Math.min(prev + 1, list.length - 1)
        )
        setErrorMessage(null)
        break
        
      case "k":
      case "up":
        setFocusedIndex(prev => 
          Math.max(prev - 1, 0)
        )
        setErrorMessage(null)
        break
        
      case "enter":
      case "return": {
        const selected = list[focusedIndex()]
        if (selected) {
          handleSelect(selected)
        }
        break
      }
    }
  })

  const modalWidth = 50
  const modalHeight = 12

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
        height={modalHeight}
        backgroundColor={colors().bg.secondary}
        borderStyle="rounded"
        borderColor={colors().border.accent}
        overflow="hidden"
      >
        {/* Header */}
        <box
          height={1}
          justifyContent="center"
          paddingLeft={1}
          paddingRight={1}
          marginBottom={1}
        >
          <text fg={colors().text.primary} attributes={BOLD}>
            Select AI Provider
          </text>
        </box>

        {/* List */}
        <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2}>
          <For each={providers()}>
            {(provider, i) => {
              const isFocused = () => i() === focusedIndex()
              const isCurrent = () => provider.id === props.currentBackend
              
              return (
                <box
                  height={1}
                  flexDirection="row"
                  alignItems="center"
                  backgroundColor={isFocused() ? colors().bg.cardSelected : undefined}
                >
                  {/* Focus Indicator */}
                  <box width={2}>
                    <text fg={colors().accent.primary}>
                      {isFocused() ? "▍" : " "}
                    </text>
                  </box>

                  {/* Selection Indicator */}
                  <box width={4}>
                    <text 
                      fg={isCurrent() ? colors().accent.success : colors().text.muted}
                      attributes={isCurrent() ? BOLD : 0}
                    >
                      {isCurrent() ? "[✓]" : "[ ]"}
                    </text>
                  </box>

                  {/* Provider Name */}
                  <text 
                    fg={isFocused() ? colors().text.primary : colors().text.secondary}
                    attributes={isFocused() ? BOLD : 0}
                  >
                    {provider.branding.displayName}
                  </text>
                </box>
              )
            }}
          </For>
        </box>

        {/* Error Message */}
        <Show when={errorMessage()}>
          <box 
            height={1} 
            paddingLeft={2} 
            paddingRight={2}
            backgroundColor="#772222"
          >
            <text fg={colors().accent.error}>
              {errorMessage()}
            </text>
          </box>
        </Show>

        {/* Footer */}
        <Footer 
          actions={[
            { key: "Enter", label: "Select" },
            { key: "Esc", label: "Cancel" }
          ]} 
          bgColor={colors().bg.primary} 
        />
      </box>
    </box>
  )
}
