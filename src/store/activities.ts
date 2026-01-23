/**
 * Activity Store
 *
 * In-memory storage for activity events parsed from session logs.
 * Provides caching and retrieval of recent activities per session.
 */

import type { ActivityEvent } from "../components/types"

// ============================================================================
// Configuration
// ============================================================================

/** Maximum number of activities to keep per session */
const MAX_ACTIVITIES_PER_SESSION = 50

// ============================================================================
// Storage
// ============================================================================

const activityCache = new Map<string, ActivityEvent[]>()

// ============================================================================
// Public API
// ============================================================================

/**
 * Get recent activities for a session
 * @param sessionId - Session ID
 * @param limit - Maximum number of activities to return (default 20)
 */
export function getRecentActivities(sessionId: string, limit = 20): ActivityEvent[] {
  const activities = activityCache.get(sessionId) ?? []
  // Return most recent activities first
  return activities.slice(-limit).reverse()
}

/**
 * Add an activity event to a session
 * @param sessionId - Session ID
 * @param event - Activity event to add
 */
export function addActivity(sessionId: string, event: ActivityEvent): void {
  let activities = activityCache.get(sessionId)
  if (!activities) {
    activities = []
    activityCache.set(sessionId, activities)
  }

  activities.push(event)

  // Trim to max size
  if (activities.length > MAX_ACTIVITIES_PER_SESSION) {
    activityCache.set(sessionId, activities.slice(-MAX_ACTIVITIES_PER_SESSION))
  }
}

/**
 * Add multiple activity events to a session
 * @param sessionId - Session ID
 * @param events - Activity events to add
 */
export function addActivities(sessionId: string, events: ActivityEvent[]): void {
  for (const event of events) {
    addActivity(sessionId, event)
  }
}

/**
 * Clear all activities for a session
 * @param sessionId - Session ID
 */
export function clearActivities(sessionId: string): void {
  activityCache.delete(sessionId)
}

/**
 * Check if a session has any activities
 * @param sessionId - Session ID
 */
export function hasActivities(sessionId: string): boolean {
  const activities = activityCache.get(sessionId)
  return !!activities && activities.length > 0
}

/**
 * Get the count of activities for a session
 * @param sessionId - Session ID
 */
export function getActivityCount(sessionId: string): number {
  return activityCache.get(sessionId)?.length ?? 0
}

/**
 * Get all session IDs that have activities
 */
export function getSessionsWithActivities(): string[] {
  return Array.from(activityCache.keys())
}
