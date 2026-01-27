/**
 * Output parser for AI session markers
 *
 * Detects OpenSWE markers with support for provider-specific patterns.
 */

import type { ParserPatterns } from "../providers/types"

export type ParsedEventType =
  | "phase"
  | "done"
  | "working"
  | "raw"

export interface ParsedEvent {
  type: ParsedEventType
  payload?: string
  line: string
}

// ============================================================================
// Default Patterns (OpenCode compatible)
// ============================================================================

const DEFAULT_PATTERNS: ParserPatterns = {
  workingRegex: /(?:starting|begin|entering).+(?:implementation|coding|execution)|(?:mode|status):\s*(?:implement|coding)/i,
  doneRegex: /\[?OPENSWE:DONE\]?/i,
}

// ============================================================================
// Parser Factory
// ============================================================================

/**
 * Create a parser function with custom patterns
 * @param patterns - Provider-specific parser patterns
 * @returns Parser function for output lines
 */
export function createParser(patterns: ParserPatterns): (line: string) => ParsedEvent | null {
  return function parseOutputLine(line: string): ParsedEvent | null {
    // Implicitly detect working phase via keywords
    if (patterns.workingRegex.test(line)) {
      return { type: "working", line }
    }

    if (patterns.doneRegex.test(line)) {
      return { type: "done", line }
    }

    return null
  }
}

// ============================================================================
// Default Parser (backward compatible)
// ============================================================================

/**
 * Parse a single output line for known markers
 * Uses default patterns for backward compatibility
 */
export const parseOutputLine = createParser(DEFAULT_PATTERNS)
