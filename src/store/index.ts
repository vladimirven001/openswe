/**
 * Store module - SQLite database layer for openswe
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
  TicketProviderType,
  AISessionData,
  Session,
  CreateSessionInput,
  UpdateSessionInput,
  ProjectState,
  CreateProjectInput,
  OutputBuffer,
} from "./types"

export {
  isValidPhase,
  isValidStatus,
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
  updateProjectTicketProvider,
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
  getSessionCountByTicketProvider,
  createSession,
  updateSession,
  updateSessionPhase,
  updateSessionStatus,
  incrementRetryCount,
  updateTokensUsed,
  setPid,
  setAISessionData,
  getAISessionData,
  resetSessionForReload,
  deleteSession,
  deleteSessionsByTicketProvider,
  deleteAllSessions,
} from "./sessions"

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