/**
 * Output parser for AI session markers
 *
 * Detects OpenSWE markers and heuristics for questions/permissions.
 */

export type ParsedEventType =
  | "phase"
  | "done"
  | "blocker"
  | "question"
  | "permission"
  | "working" // New event type
  | "raw"

export interface ParsedEvent {
  type: ParsedEventType
  payload?: string
  line: string
}

// const PHASE_REGEX = /\[?OPENSWE:PHASE:([\w-]+)\]?/i // Removed
const DONE_REGEX = /\[?OPENSWE:DONE\]?/i
const BLOCKER_REGEX = /\[?OPENSWE:BLOCKER:([^\]]+?)\]?/i
const WORKING_REGEX = /(?:starting|begin|entering).+(?:implementation|coding|execution)|(?:mode|status):\s*(?:implement|coding)/i

const QUESTION_PREFIX_REGEX = /^\s*(Question:|Q:)\s*/i
const PERMISSION_PREFIX_REGEX = /^\s*(Permission:|Perm:)\s*/i
const PERMISSION_INLINE_REGEX = /\bRun `[^`]+`\?/i

const TOOL_CALL_REGEX = /\[tool_call:\s*(\w+)/i

/**
 * Parse a single output line for known markers
 */
export function parseOutputLine(line: string): ParsedEvent | null {
  // Implicitly detect working phase via keywords
  if (WORKING_REGEX.test(line)) {
    return { type: "working", line }
  }

  // Detect tool calls for phase transitions and human interaction
  const toolMatch = line.match(TOOL_CALL_REGEX)
  if (toolMatch && toolMatch[1]) {
    const toolName = toolMatch[1].toLowerCase()
    
    // writing/editing = working (Build) phase
    if (toolName === "edit" || toolName === "write") {
      return { type: "working", line }
    }

    // question = human input
    if (toolName === "question" || toolName === "ask_user") {
      return { 
        type: "question", 
        payload: "User input requested via tool", 
        line 
      }
    }
  }

  if (DONE_REGEX.test(line)) {
    return { type: "done", line }
  }

  const blockerMatch = line.match(BLOCKER_REGEX)
  if (blockerMatch) {
    return { type: "blocker", payload: blockerMatch[1], line }
  }

  const questionPrefix = line.match(QUESTION_PREFIX_REGEX)
  if (questionPrefix) {
    return {
      type: "question",
      payload: line.replace(QUESTION_PREFIX_REGEX, "").trim(),
      line,
    }
  }

  const permissionPrefix = line.match(PERMISSION_PREFIX_REGEX)
  if (permissionPrefix) {
    return {
      type: "permission",
      payload: line.replace(PERMISSION_PREFIX_REGEX, "").trim(),
      line,
    }
  }

  if (PERMISSION_INLINE_REGEX.test(line)) {
    return { type: "permission", payload: line.trim(), line }
  }

  if (line.trim().endsWith("?")) {
    return { type: "question", payload: line.trim(), line }
  }

  return null
}
