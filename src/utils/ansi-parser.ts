/**
 * ANSI SGR sequence parser
 *
 * Parses ANSI escape sequences and returns styled text segments
 * for rendering in the Preview component.
 *
 * Handles SGR (Select Graphic Rendition) sequences for colors/styles
 * and strips other control sequences (cursor movement, screen clearing, etc.)
 */

/**
 * Strip non-SGR ANSI sequences from text
 *
 * Removes cursor movement, screen clearing, and other control sequences
 * while preserving SGR color/style sequences (those ending with 'm')
 */
function stripNonSGRSequences(text: string): string {
  // Match CSI sequences that are NOT SGR (don't end with 'm')
  // CSI format: ESC [ <params> <final byte>
  // SGR ends with 'm', others end with A-L, P-Z, @, etc.
  // Also strips OSC sequences (ESC ] ... BEL/ST)
  return text
    // Remove CSI sequences that don't end with 'm' (cursor movement, clearing, etc.)
    .replace(/\x1B\[[0-9;]*[A-LN-Za-ln-z@`{}|~]/g, "")
    // Remove OSC sequences (ESC ] ... BEL or ESC ] ... ESC \)
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)?/g, "")
    // Remove other escape sequences (ESC followed by single char)
    .replace(/\x1B[^[\]]/g, "")
}

export interface AnsiSegment {
  text: string
  fg?: string      // Hex color
  bg?: string      // Hex color
  bold?: boolean
}

// Standard 16-color palette (colors 0-15)
const STANDARD_COLORS: Record<number, string> = {
  0: "#000000",   // Black
  1: "#cd0000",   // Red
  2: "#00cd00",   // Green
  3: "#cdcd00",   // Yellow
  4: "#0000ee",   // Blue
  5: "#cd00cd",   // Magenta
  6: "#00cdcd",   // Cyan
  7: "#e5e5e5",   // White
  8: "#7f7f7f",   // Bright Black (Gray)
  9: "#ff0000",   // Bright Red
  10: "#00ff00",  // Bright Green
  11: "#ffff00",  // Bright Yellow
  12: "#5c5cff",  // Bright Blue
  13: "#ff00ff",  // Bright Magenta
  14: "#00ffff",  // Bright Cyan
  15: "#ffffff",  // Bright White
}

/**
 * Convert 256-color index to hex color
 */
function color256ToHex(n: number): string {
  // Standard colors (0-15)
  if (n < 16) {
    return STANDARD_COLORS[n] ?? "#ffffff"
  }

  // Color cube (16-231): 6x6x6 cube
  if (n < 232) {
    const idx = n - 16
    const r = Math.floor(idx / 36)
    const g = Math.floor((idx % 36) / 6)
    const b = idx % 6

    const toHex = (v: number) => (v === 0 ? 0 : 55 + v * 40).toString(16).padStart(2, "0")
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }

  // Grayscale (232-255): 24 shades
  const gray = (n - 232) * 10 + 8
  const hex = gray.toString(16).padStart(2, "0")
  return `#${hex}${hex}${hex}`
}

/**
 * Convert RGB values to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

interface AnsiState {
  fg?: string
  bg?: string
  bold: boolean
}

/**
 * Parse SGR (Select Graphic Rendition) parameters and update state
 */
function parseSGR(params: number[], state: AnsiState): void {
  let i = 0
  while (i < params.length) {
    const code = params[i] ?? 0

    if (code === 0) {
      // Reset all
      state.fg = undefined
      state.bg = undefined
      state.bold = false
    } else if (code === 1) {
      // Bold on
      state.bold = true
    } else if (code === 22) {
      // Bold off
      state.bold = false
    } else if (code >= 30 && code <= 37) {
      // Standard foreground colors
      state.fg = STANDARD_COLORS[code - 30]
    } else if (code === 39) {
      // Default foreground
      state.fg = undefined
    } else if (code >= 40 && code <= 47) {
      // Standard background colors
      state.bg = STANDARD_COLORS[code - 40]
    } else if (code === 49) {
      // Default background
      state.bg = undefined
    } else if (code >= 90 && code <= 97) {
      // Bright foreground colors
      state.fg = STANDARD_COLORS[code - 90 + 8]
    } else if (code >= 100 && code <= 107) {
      // Bright background colors
      state.bg = STANDARD_COLORS[code - 100 + 8]
    } else if (code === 38) {
      // Extended foreground color
      const nextParam = params[i + 1]
      const colorIndex = params[i + 2]
      if (nextParam === 5 && colorIndex !== undefined) {
        // 256-color mode: 38;5;N
        state.fg = color256ToHex(colorIndex)
        i += 2
      } else if (nextParam === 2 && params[i + 4] !== undefined) {
        // True color mode: 38;2;R;G;B
        state.fg = rgbToHex(params[i + 2] ?? 0, params[i + 3] ?? 0, params[i + 4] ?? 0)
        i += 4
      }
    } else if (code === 48) {
      // Extended background color
      const nextParam = params[i + 1]
      const colorIndex = params[i + 2]
      if (nextParam === 5 && colorIndex !== undefined) {
        // 256-color mode: 48;5;N
        state.bg = color256ToHex(colorIndex)
        i += 2
      } else if (nextParam === 2 && params[i + 4] !== undefined) {
        // True color mode: 48;2;R;G;B
        state.bg = rgbToHex(params[i + 2] ?? 0, params[i + 3] ?? 0, params[i + 4] ?? 0)
        i += 4
      }
    }
    // Ignore unhandled codes

    i++
  }
}

/**
 * Parse a line containing ANSI escape sequences into styled segments
 */
export function parseAnsiLine(line: string): AnsiSegment[] {
  const segments: AnsiSegment[] = []
  const state: AnsiState = { bold: false }

  // First strip non-SGR sequences (cursor movement, etc.) that would cause garbling
  const cleanedLine = stripNonSGRSequences(line)

  // Match ANSI SGR sequences: ESC [ params m
  const regex = /\x1B\[([0-9;]*)m/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(cleanedLine)) !== null) {
    // Add text before this escape sequence
    if (match.index > lastIndex) {
      const text = cleanedLine.slice(lastIndex, match.index)
      if (text) {
        segments.push({
          text,
          fg: state.fg,
          bg: state.bg,
          bold: state.bold || undefined,
        })
      }
    }

    // Parse SGR parameters
    const paramStr = match[1] ?? ""
    const params = paramStr === "" ? [0] : paramStr.split(";").map((s) => parseInt(s, 10) || 0)
    parseSGR(params, state)

    lastIndex = regex.lastIndex
  }

  // Add remaining text after last escape sequence
  if (lastIndex < cleanedLine.length) {
    const text = cleanedLine.slice(lastIndex)
    if (text) {
      segments.push({
        text,
        fg: state.fg,
        bg: state.bg,
        bold: state.bold || undefined,
      })
    }
  }

  // If no segments, return single segment with cleaned text
  if (segments.length === 0) {
    return [{ text: cleanedLine || " " }]
  }

  return segments
}
