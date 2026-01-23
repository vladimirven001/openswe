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
  | "raw"

export interface ParsedEvent {
  type: ParsedEventType
  payload?: string
  line: string
}

const PHASE_REGEX = /\[OPENSWE:PHASE:([\w-]+)\]/
const DONE_REGEX = /\[OPENSWE:DONE\]/
const BLOCKER_REGEX = /\[OPENSWE:BLOCKER:([^\]]+)\]/

const QUESTION_PREFIX_REGEX = /^\s*(Question:|Q:)\s*/i
const PERMISSION_PREFIX_REGEX = /^\s*(Permission:|Perm:)\s*/i
const PERMISSION_INLINE_REGEX = /\bRun `[^`]+`\?/i

/**
 * Parse a single output line for known markers
 */
export function parseOutputLine(line: string): ParsedEvent | null {
  const phaseMatch = line.match(PHASE_REGEX)
  if (phaseMatch) {
    return { type: "phase", payload: phaseMatch[1], line }
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
