/**
 * Human task queue manager
 *
 * Creates tasks for human intervention and ties them to sessions.
 */

import { createTask, updateSessionStatus, getSession } from "../store"
import type { HumanTask, TaskPriority, TaskType } from "../store"

interface TaskContext {
  sessionId: string
  title: string
  type: TaskType
  priority: TaskPriority
  context?: string
  rawOutput?: string
}

function createTaskForSession(data: TaskContext): HumanTask {
  const session = getSession(data.sessionId)
  if (!session) {
    throw new Error(`Session not found: ${data.sessionId}`)
  }

  updateSessionStatus(session.id, "needs_attention", data.title)

  return createTask({
    sessionId: session.id,
    sessionName: session.name,
    issueNumber: session.issueNumber ?? undefined,
    type: data.type,
    priority: data.priority,
    title: data.title,
    context: data.context,
    rawOutput: data.rawOutput,
  })
}

export class TaskQueueManager {
  createFromBlocker(sessionId: string, description: string): HumanTask {
    return createTaskForSession({
      sessionId,
      title: description,
      type: "blocker",
      priority: "high",
      context: description,
    })
  }

  createFromQuestion(sessionId: string, question: string): HumanTask {
    return createTaskForSession({
      sessionId,
      title: question,
      type: "question",
      priority: "high",
      context: question,
    })
  }

  createFromPermission(sessionId: string, request: string): HumanTask {
    return createTaskForSession({
      sessionId,
      title: request,
      type: "permission",
      priority: "high",
      context: request,
    })
  }

  createFromRetryFailed(sessionId: string): HumanTask {
    return createTaskForSession({
      sessionId,
      title: "Session failed after retries",
      type: "retry_failed",
      priority: "normal",
    })
  }

  createPRReview(sessionId: string, prUrl: string): HumanTask {
    return createTaskForSession({
      sessionId,
      title: "PR ready for review",
      type: "pr_review",
      priority: "low",
      context: prUrl,
    })
  }
}
