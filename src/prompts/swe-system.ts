/**
 * SWE system prompt generator
 *
 * Creates the system prompt used to guide AI coding sessions.
 */

import type { Session } from "../store"

/**
 * Generate the SWE system prompt for a session
 */
export function generateSWEPrompt(session: Session): string {
  const taskSection = session.issueNumber
    ? `Title: Issue #${session.issueNumber}: "${session.issueTitle ?? ""}"
${session.issueBody ?? ""}`
    : `Task: ${session.name}`

  return `Investigate and create a plan to implement this feature:

${taskSection}
`
}
