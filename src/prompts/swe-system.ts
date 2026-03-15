/**
 * SWE system prompt generator
 *
 * Creates the system prompt used to guide AI coding sessions.
 */

import type { Session } from "../store"

const MAX_COMMENTS = 5
const MAX_COMMENT_BODY_LENGTH = 600
const MAX_TOTAL_COMMENTS_LENGTH = 2400

/**
 * Generate the SWE system prompt for a session
 */
export function generateSWEPrompt(session: Session): string {
  const commentsSection = formatCommentsSection(session)
  const taskSection = session.issueNumber
    ? `Title: Issue #${session.issueNumber}: "${session.issueTitle ?? ""}"
${session.issueBody ?? ""}${commentsSection}`
    : `Task: ${session.name}`

  return `Investigate and create a plan to implement this feature:

${taskSection}
`
}

function formatCommentsSection(session: Session): string {
  if (session.issueComments.length === 0) {
    return ""
  }

  const selectedComments = session.issueComments.slice(-MAX_COMMENTS)
  let totalLength = 0
  const lines: string[] = []

  for (const comment of selectedComments) {
    if (totalLength >= MAX_TOTAL_COMMENTS_LENGTH) {
      break
    }

    const remaining = MAX_TOTAL_COMMENTS_LENGTH - totalLength
    const truncatedBody = truncateCommentBody(comment.body, Math.min(MAX_COMMENT_BODY_LENGTH, remaining))

    if (!truncatedBody) {
      continue
    }

    totalLength += truncatedBody.length

    const author = comment.author ?? "unknown"
    lines.push(`- ${author}: ${truncatedBody}`)
  }

  if (lines.length === 0) {
    return ""
  }

  return `

Issue Comments:
${lines.join("\n")}`
}

function truncateCommentBody(body: string, maxLength: number): string {
  const normalized = body.replace(/\s+/g, " ").trim()

  if (!normalized || maxLength <= 0) {
    return ""
  }

  if (normalized.length <= maxLength) {
    return normalized
  }

  if (maxLength <= 3) {
    return normalized.slice(0, maxLength)
  }

  return `${normalized.slice(0, maxLength - 3)}...`
}
