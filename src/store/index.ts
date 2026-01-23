/**
 * Store module - SQLite database layer for OpenSWE
 *
 * Provides persistent storage for sessions, human tasks, project state,
 * and output buffers using Bun's native bun:sqlite.
 */

// ============================================================================
// Types
// ============================================================================

export type {
  Phase,
  Status,
  TaskType,
  TaskPriority,
  AISessionData,
  Session,
  CreateSessionInput,
  UpdateSessionInput,
  HumanTask,
  CreateTaskInput,
  ProjectState,
  CreateProjectInput,
  OutputBuffer,
} from "./types"

export {
  isValidPhase,
  isValidStatus,
  isValidTaskType,
  isValidTaskPriority,
  isValidAISessionData,
} from "./types"

// ============================================================================
// Database Connection
// ============================================================================

export {
  createDatabaseManager,
  setDatabaseManager,
  getDatabase,
  initDatabase,
  initDatabaseWithPath,
  closeDatabase,
  isDatabaseInitialized,
  getDatabasePath,
  getSchemaVersion,
  runMigrations,
  withTransaction,
  nowISO,
} from "./db"

// ============================================================================
// Project Operations
// ============================================================================

export {
  getProject,
  createProject,
  updateLastOpened,
  updateMaxSessions,
  projectExists,
  deleteProject,
} from "./project"

// ============================================================================
// Session Operations
// ============================================================================

export {
  getAllSessions,
  getSession,
  getSessionsByStatus,
  getSessionsByPhase,
  getActiveSessionCount,
  getSessionCount,
  createSession,
  updateSession,
  updateSessionPhase,
  updateSessionStatus,
  incrementRetryCount,
  updateTokensUsed,
  setPrUrl,
  setPid,
  setAISessionData,
  getAISessionData,
  deleteSession,
  deleteAllSessions,
} from "./sessions"

// ============================================================================
// Task Operations
// ============================================================================

export {
  getAllTasks,
  getTask,
  getUnresolvedTasks,
  getUnresolvedTaskCount,
  getTasksBySession,
  getUnresolvedTasksBySession,
  getTasksByType,
  createTask,
  resolveTask,
  unresolveTask,
  deleteTask,
  deleteTasksBySession,
  deleteResolvedTasks,
} from "./tasks"

// ============================================================================
// Buffer Operations
// ============================================================================

export {
  MAX_BUFFER_LINES,
  getBuffer,
  getRecentLines,
  getAllLines,
  createBuffer,
  ensureBuffer,
  appendLines,
  appendLine,
  setLines,
  clearBuffer,
  deleteBuffer,
} from "./buffers"
