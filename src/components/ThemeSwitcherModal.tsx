/**
 * ThemeSwitcherModal component - Allows switching UI themes
 *
 * Displays a scrollable list of available themes and lets the user select one.
 */

import { createSignal, onMount, For, createMemo } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { ThemeSwitcherModalProps } from "./types"
import { useTheme } from "../theme"
import { Footer } from "./Footer"
import { colors } from "./theme"

// Bold attribute constant
const BOLD = 1

export function ThemeSwitcherModal(props: ThemeSwitcherModalProps) {
  const { availableThemes } = useTheme()
  const [focusedIndex, setFocusedIndex] = createSignal(0)
  
  // Viewport state for scrolling
  const VIEWPORT_HEIGHT = 10
  const [viewportStart, setViewportStart] = createSignal(0)

  const themes = createMemo(() => availableThemes())

  onMount(() => {
    const all = themes()
    
    // Set initial focus to current theme
    const idx = all.findIndex(t => t === props.currentTheme)
    if (idx !== -1) {
      setFocusedIndex(idx)
      // Center the initial selection in viewport if possible
      const start = Math.max(0, Math.min(idx - Math.floor(VIEWPORT_HEIGHT / 2), all.length - VIEWPORT_HEIGHT))
      setViewportStart(start)
    }
  })

  // Ensure viewport follows focus
  const updateViewport = (newIndex: number) => {
    const currentStart = viewportStart()
    
    if (newIndex < currentStart) {
      // Scrolled up past top
      setViewportStart(newIndex)
    } else if (newIndex >= currentStart + VIEWPORT_HEIGHT) {
      // Scrolled down past bottom
      setViewportStart(newIndex - VIEWPORT_HEIGHT + 1)
    }
  }

  useKeyboard((event) => {
    const list = themes()
    
    switch (event.name) {
      case "escape":
        props.onClose()
        break
        
      case "j":
      case "down": {
        const next = Math.min(focusedIndex() + 1, list.length - 1)
        setFocusedIndex(next)
        updateViewport(next)
        break
      }
        
      case "k":
      case "up": {
        const prev = Math.max(focusedIndex() - 1, 0)
        setFocusedIndex(prev)
        updateViewport(prev)
        break
      }

      case "pageup": {
        const prev = Math.max(focusedIndex() - VIEWPORT_HEIGHT, 0)
        setFocusedIndex(prev)
        updateViewport(prev)
        break
      }

      case "pagedown": {
        const next = Math.min(focusedIndex() + VIEWPORT_HEIGHT, list.length - 1)
        setFocusedIndex(next)
        updateViewport(next)
        break
      }
        
      case "enter":
      case "return": {
        const selected = list[focusedIndex()]
        if (selected) {
          props.onSelect(selected)
        }
        break
      }
    }
  })

  // Visible items based on viewport
  const visibleThemes = createMemo(() => {
    const all = themes()
    const start = viewportStart()
    return all.slice(start, start + VIEWPORT_HEIGHT).map((name, i) => ({
      name,
      originalIndex: start + i
    }))
  })

  // Calculate scrollbar
  const scrollbarInfo = createMemo(() => {
    const total = themes().length
    const start = viewportStart()
    const height = VIEWPORT_HEIGHT
    
    if (total <= height) return null
    
    const trackHeight = height
    const thumbHeight = Math.max(1, Math.floor((height / total) * trackHeight))
    const thumbTop = Math.floor((start / (total - height)) * (trackHeight - thumbHeight))
    
    return { thumbHeight, thumbTop }
  })

  const modalWidth = 50
  // Header + List + Footer + Padding
  const modalHeight = VIEWPORT_HEIGHT + 4 

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
        backgroundColor={colors.bg.secondary}
        borderStyle="rounded"
        borderColor={colors.border.accent}
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
          <text fg={colors.text.primary} attributes={BOLD}>
            Select Theme ({focusedIndex() + 1}/{themes().length})
          </text>
        </box>

        {/* List Container with Scrollbar */}
        <box flexDirection="row" flexGrow={1} paddingLeft={2} paddingRight={1}>
          {/* List */}
          <box flexDirection="column" flexGrow={1}>
            <For each={visibleThemes()}>
              {(item) => {
                const isFocused = () => item.originalIndex === focusedIndex()
                const isCurrent = () => item.name === props.currentTheme
                
                return (
                  <box
                    height={1}
                    flexDirection="row"
                    alignItems="center"
                    backgroundColor={isFocused() ? colors.bg.cardSelected : undefined}
                  >
                    {/* Focus Indicator */}
                    <box width={2}>
                      <text fg={colors.accent.primary}>
                        {isFocused() ? "▍" : " "}
                      </text>
                    </box>

                    {/* Selection Indicator */}
                    <box width={4}>
                      <text 
                        fg={isCurrent() ? colors.accent.success : colors.text.muted}
                        attributes={isCurrent() ? BOLD : 0}
                      >
                        {isCurrent() ? "[✓]" : "[ ]"}
                      </text>
                    </box>

                    {/* Theme Name */}
                    <text 
                      fg={isFocused() ? colors.text.primary : colors.text.secondary}
                      attributes={isFocused() ? BOLD : 0}
                    >
                      {item.name}
                    </text>
                  </box>
                )
              }}
            </For>
          </box>

          {/* Scrollbar */}
          <box width={1} flexDirection="column" marginLeft={1}>
            {scrollbarInfo() && (
              <>
                {/* Track above thumb */}
                <box height={scrollbarInfo()!.thumbTop} />
                
                {/* Thumb */}
                <box height={scrollbarInfo()!.thumbHeight}>
                  <text fg={colors.border.accent}>│</text>
                </box>
              </>
            )}
          </box>
        </box>

        {/* Footer */}
        <Footer 
          actions={[
            { key: "Enter", label: "Select" },
            { key: "Esc", label: "Cancel" }
          ]} 
          bgColor={colors.bg.primary} 
        />
      </box>
    </box>
  )
}
