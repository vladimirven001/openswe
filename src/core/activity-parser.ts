/**
 * Activity Parser
 *
 * Parses log output from AI sessions to extract meaningful activity events
 * for display in the timeline preview.
 */

import type { ActivityEvent, ActivityEventType } from "../components/types"
import { ACTIVITY_ICONS } from "../components/types"

// ============================================================================
// Pattern Definitions
// ============================================================================

interface PatternConfig {
  type: ActivityEventType
  patterns: RegExp[]
  extractTitle: (match: RegExpMatchArray, line: string) => string
  extractDetail?: (match: RegExpMatchArray, line: string) => string | undefined
}

const PATTERNS: PatternConfig[] = [
  // File read operations
  {
    type: "file_read",
    patterns: [
      /Read(?:ing)?\s+(?:file\s+)?["`']?([^"`'\n]+)["`']?/i,
      /Reading\s+([^\s]+\.[a-z]+)/i,
      /cat\s+([^\s|]+)/,
      /Viewing\s+([^\s]+)/i,
    ],
    extractTitle: (match) => {
      const path = match[1] ?? "file"
      const filename = path.split("/").pop() ?? path
      return `Read ${truncatePath(filename, 30)}`
    },
    extractDetail: (match) => match[1],
  },

  // File edit operations
  {
    type: "file_edit",
    patterns: [
      /Edit(?:ing)?\s+(?:file\s+)?["`']?([^"`'\n]+)["`']?/i,
      /Modifying\s+([^\s]+)/i,
      /Updated?\s+([^\s]+\.[a-z]+)/i,
    ],
    extractTitle: (match) => {
      const path = match[1] ?? "file"
      const filename = path.split("/").pop() ?? path
      return `Edit ${truncatePath(filename, 30)}`
    },
    extractDetail: (match) => match[1],
  },

  // File write operations
  {
    type: "file_write",
    patterns: [
      /Writ(?:e|ing)\s+(?:file\s+)?["`']?([^"`'\n]+)["`']?/i,
      /Creat(?:e|ing)\s+(?:file\s+)?["`']?([^"`'\n]+)["`']?/i,
    ],
    extractTitle: (match) => {
      const path = match[1] ?? "file"
      const filename = path.split("/").pop() ?? path
      return `Write ${truncatePath(filename, 30)}`
    },
    extractDetail: (match) => match[1],
  },

  // Search operations
  {
    type: "search",
    patterns: [
      /Grep(?:ping)?\s+(?:for\s+)?["`']?([^"`'\n]+)["`']?/i,
      /Glob(?:bing)?\s+["`']?([^"`'\n]+)["`']?/i,
      /Search(?:ing)?\s+(?:for\s+)?["`']?([^"`'\n]+)["`']?/i,
      /Find(?:ing)?\s+["`']?([^"`'\n]+)["`']?/i,
    ],
    extractTitle: (match) => {
      const pattern = match[1] ?? "pattern"
      return `Search: ${truncatePath(pattern, 25)}`
    },
  },

  // Bash/command operations
  {
    type: "bash",
    patterns: [
      /Bash\s*(?:command)?:\s*["`']?(.+)["`']?$/i,
      /Running\s+(?:command\s+)?["`']?(.+)["`']?$/i,
      /Executing?\s+["`']?(.+)["`']?$/i,
      /\$\s+(.+)$/,
    ],
    extractTitle: (match) => {
      const cmd = match[1] ?? "command"
      const cmdName = cmd.split(" ")[0] ?? cmd
      return `Run: ${truncatePath(cmdName, 25)}`
    },
    extractDetail: (match) => match[1],
  },

  // Git operations
  {
    type: "git",
    patterns: [
      /git\s+(commit|push|pull|checkout|merge|rebase|add|status|diff|log|branch)/i,
      /Commit(?:ting)?:\s*(.+)/i,
      /Push(?:ing)?\s+(?:to\s+)?(.+)/i,
    ],
    extractTitle: (match) => {
      const op = match[1] ?? "operation"
      return `Git ${op}`
    },
  },

  // Test operations
  {
    type: "test",
    patterns: [
      /(?:bun|npm|yarn|pnpm)\s+(?:run\s+)?test/i,
      /jest|vitest|mocha|pytest|cargo\s+test/i,
      /Tests?\s+(pass(?:ing|ed)?|fail(?:ing|ed)?)/i,
      /Running\s+tests?/i,
    ],
    extractTitle: (match) => {
      const result = match[1]?.toLowerCase()
      if (result?.includes("pass")) return "Tests passing"
      if (result?.includes("fail")) return "Tests failing"
      return "Running tests"
    },
  },

  // Phase markers (OpenSWE specific)
  {
    type: "phase",
    patterns: [
      /\[?OPENSWE:PHASE:(\w+)\]?/i,
      /Entering?\s+(research|planning|coding|testing|pr_creation)\s+phase/i,
    ],
    extractTitle: (match) => {
      const phase = match[1] ?? "unknown"
      return `Entered ${phase} phase`
    },
  },

  // Thinking/planning
  {
    type: "thinking",
    patterns: [
      /Thinking\s+about\s+(.+)/i,
      /Planning\s+(.+)/i,
      /Analyzing\s+(.+)/i,
      /Considering\s+(.+)/i,
    ],
    extractTitle: (match) => {
      const subject = match[1] ?? "approach"
      return `Thinking: ${truncatePath(subject, 25)}`
    },
  },

  // Questions/blockers
  {
    type: "question",
    patterns: [
      /\[?OPENSWE:BLOCKER:(.+?)\]?/i,
      /\[?OPENSWE:QUESTION:(.+?)\]?/i,
      /Question:\s*(.+)/i,
      /Need(?:s|ing)?\s+(?:clarification|input|help)/i,
    ],
    extractTitle: (match) => {
      const question = match[1]
      if (question) return `Question: ${truncatePath(question, 25)}`
      return "Needs attention"
    },
  },

  // Errors
  {
    type: "error",
    patterns: [
      /Error:\s*(.+)/i,
      /Failed:\s*(.+)/i,
      /Exception:\s*(.+)/i,
      /FATAL:\s*(.+)/i,
    ],
    extractTitle: (match) => {
      const msg = match[1] ?? "Unknown error"
      return `Error: ${truncatePath(msg, 25)}`
    },
    extractDetail: (match) => match[1],
  },
]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncate a path or string to a maximum length
 */
function truncatePath(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + "..."
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse a single log line and extract an activity event if detected
 */
export function parseActivityFromLine(line: string): ActivityEvent | null {
  // Skip empty lines or lines that are just whitespace
  const trimmed = line.trim()
  if (!trimmed) return null

  // Try each pattern group
  for (const config of PATTERNS) {
    for (const pattern of config.patterns) {
      const match = trimmed.match(pattern)
      if (match) {
        return {
          type: config.type,
          timestamp: new Date(),
          title: config.extractTitle(match, trimmed),
          detail: config.extractDetail?.(match, trimmed),
          icon: ACTIVITY_ICONS[config.type],
        }
      }
    }
  }

  return null
}

/**
 * Parse multiple log lines and extract activity events
 * Deduplicates rapid events of the same type
 */
export function parseActivitiesFromLines(
  lines: string[],
  dedupeWindowMs = 500
): ActivityEvent[] {
  const events: ActivityEvent[] = []
  let lastEvent: ActivityEvent | null = null

  for (const line of lines) {
    const event = parseActivityFromLine(line)
    if (!event) continue

    // Dedupe rapid events of the same type
    if (lastEvent) {
      const timeDiff = event.timestamp.getTime() - lastEvent.timestamp.getTime()
      if (
        event.type === lastEvent.type &&
        event.title === lastEvent.title &&
        timeDiff < dedupeWindowMs
      ) {
        continue // Skip duplicate
      }
    }

    events.push(event)
    lastEvent = event
  }

  return events
}
