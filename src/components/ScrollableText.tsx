/**
 * ScrollableText component - Displays text that scrolls horizontally if it exceeds width
 *
 * Behavior:
 * - If text fits in width: Renders statically
 * - If text exceeds width AND isActive is true: Scrolls horizontally (marquee)
 * - If text exceeds width AND isActive is false: Truncates with ellipsis
 */

import { createSignal, createEffect, onCleanup, mergeProps, Show } from "solid-js"
import { truncate } from "../utils/format"

export interface ScrollableTextProps {
  text: string
  width: number
  isActive?: boolean
  fg?: string
  attributes?: number
  align?: "left" | "right" | "center"
  speed?: number
  delay?: number
}

export function ScrollableText(props: ScrollableTextProps) {
  const merged = mergeProps({ 
    isActive: true, 
    speed: 200, 
    delay: 1500,
    align: "left"
  }, props)

  const [offset, setOffset] = createSignal(0)
  const [isScrolling, setIsScrolling] = createSignal(false)

  // Reset offset when active state or text changes
  createEffect(() => {
    // Dependencies
    const text = merged.text
    const active = merged.isActive

    if (!active) {
      setOffset(0)
      setIsScrolling(false)
      return
    }

    // If text fits, don't scroll
    if (text.length <= merged.width) {
      setOffset(0)
      setIsScrolling(false)
      return
    }

    // Reset offset initially
    setOffset(0)
    setIsScrolling(false)

    // Start delay timer
    const delayTimer = setTimeout(() => {
      setIsScrolling(true)
    }, merged.delay)

    onCleanup(() => clearTimeout(delayTimer))
  })

  // Scrolling interval
  createEffect(() => {
    if (!isScrolling() || !merged.isActive) return

    const interval = setInterval(() => {
      setOffset((prev) => prev + 1)
    }, merged.speed)

    onCleanup(() => clearInterval(interval))
  })

  const displayText = () => {
    const { text, width, isActive } = merged
    
    // Static case: Fits in width
    if (text.length <= width) {
      // Handle alignment
      if (merged.align === "center") {
        const pad = Math.floor((width - text.length) / 2)
        return text.padStart(text.length + pad).padEnd(width)
      }
      if (merged.align === "right") {
        return text.padStart(width)
      }
      return text.padEnd(width)
    }

    // Inactive case: Truncate
    if (!isActive) {
      return truncate(text, width)
    }

    // Active scrolling case
    // We add spacing equal to width/3 (min 3 chars) between loops
    const spacer = "   " 
    const fullText = text + spacer
    const currentOffset = offset() % fullText.length
    
    // Create the window
    let slice = fullText.slice(currentOffset, currentOffset + width)
    
    // If slice is shorter than width (hit end of string), append start
    if (slice.length < width) {
      slice += fullText.slice(0, width - slice.length)
    }
    
    return slice
  }

  return (
    <text fg={merged.fg} attributes={merged.attributes}>
      {displayText()}
    </text>
  )
}
