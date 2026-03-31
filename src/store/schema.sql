-- openswe Database Schema
-- SQLite database for persistent storage of sessions, tasks, and project state

-- ============================================================================
-- Schema Version
-- ============================================================================

-- Track schema version for migrations
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert initial version if not exists
INSERT OR IGNORE INTO schema_version (version) VALUES (1);

-- ============================================================================
-- Project Table (Singleton)
-- ============================================================================

-- Project metadata - only one row (id = 1)
CREATE TABLE IF NOT EXISTS project (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  repo_full_name TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_opened_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- Sessions Table
-- ============================================================================

-- Sessions represent work on specific issues or tasks
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  issue_number INTEGER,
  issue_title TEXT,
  issue_body TEXT,
  issue_comments TEXT NOT NULL DEFAULT '[]',
  issue_url TEXT,
  worktree_path TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'queued',
  attention_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  pid INTEGER,
  ai_session_data TEXT,                   -- JSON: {backend, sessionId, ...}
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for querying sessions by status
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Index for querying sessions by phase
CREATE INDEX IF NOT EXISTS idx_sessions_phase ON sessions(phase);

-- ============================================================================
-- Output Buffers Table
-- ============================================================================

-- Circular buffers for session output (stored as JSON array)
CREATE TABLE IF NOT EXISTS output_buffers (
  session_id TEXT PRIMARY KEY,
  lines TEXT NOT NULL DEFAULT '[]',
  last_updated TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
