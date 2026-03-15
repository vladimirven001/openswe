/**
 * Database connection and initialization
 *
 * Manages the SQLite database connection using Bun's native bun:sqlite.
 * Uses WAL mode for better concurrency.
 */

import { Database } from "bun:sqlite"
import { dirname } from "path"
import { getStateDatabasePath } from "../workspace/paths"

// ============================================================================
// Schema
// ============================================================================

// Import schema as raw text
import schema from "./schema.sql" with { type: "text" }

// ============================================================================
// Manager Types
// ============================================================================

export interface DatabaseManager {
  getDatabase: () => Database
  initDatabase: (projectRoot: string) => Promise<void>
  initDatabaseWithPath: (dbPath: string) => Promise<void>
  closeDatabase: () => void
  isDatabaseInitialized: () => boolean
  getDatabasePath: () => string | null
  getSchemaVersion: () => number
  runMigrations: () => void
  withTransaction: <T>(fn: () => T) => T
}

// ============================================================================
// Database Manager Factory
// ============================================================================

export function createDatabaseManager(): DatabaseManager {
  let db: Database | null = null
  let currentDbPath: string | null = null

  const getDatabase = (): Database => {
    if (!db) {
      throw new Error(
        "Database not initialized. Call initDatabase() first."
      )
    }
    return db
  }

  const applySchema = (): void => {
    if (!db) {
      throw new Error("Database not initialized")
    }

    // Execute schema as a transaction
    db.exec(schema)
  }

  const initDatabase = async (projectRoot: string): Promise<void> => {
    const dbPath = getStateDatabasePath(projectRoot)

    // If already connected to this database, skip
    if (db && currentDbPath === dbPath) {
      return
    }

    // Close existing connection if any
    if (db) {
      closeDatabase()
    }

    // Ensure directory exists
    const dir = dirname(dbPath)
    await Bun.write(dir + "/.keep", "")

    // Open database connection
    db = new Database(dbPath, { create: true })
    currentDbPath = dbPath

    // Enable WAL mode for better concurrency
    db.exec("PRAGMA journal_mode = WAL")

    // Enable foreign keys
    db.exec("PRAGMA foreign_keys = ON")

    // Apply schema
    applySchema()
    runMigrations()
  }

  const initDatabaseWithPath = async (dbPath: string): Promise<void> => {
    // Close existing connection if any
    if (db) {
      closeDatabase()
    }

    // For in-memory databases, skip directory creation
    if (dbPath !== ":memory:") {
      const dir = dirname(dbPath)
      await Bun.write(dir + "/.keep", "")
    }

    // Open database connection
    db = new Database(dbPath, { create: true })
    currentDbPath = dbPath

    // Enable WAL mode for better concurrency (skip for in-memory)
    if (dbPath !== ":memory:") {
      db.exec("PRAGMA journal_mode = WAL")
    }

    // Enable foreign keys
    db.exec("PRAGMA foreign_keys = ON")

    // Apply schema
    applySchema()
    runMigrations()
  }

  const closeDatabase = (): void => {
    if (db) {
      db.close()
      db = null
      currentDbPath = null
    }
  }

  const isDatabaseInitialized = (): boolean => {
    return db !== null
  }

  const getDatabasePath = (): string | null => {
    return currentDbPath
  }

  const getSchemaVersion = (): number => {
    const database = getDatabase()
    const result = database
      .query<{ version: number }, []>(
        "SELECT MAX(version) as version FROM schema_version"
      )
      .get()
    return result?.version ?? 0
  }

  const runMigrations = (): void => {
    const version = getSchemaVersion()
    const database = getDatabase()

    // Migration to version 2: Add ai_session_data column
    if (version < 2) {
      // Check if column exists (for databases created with new schema)
      const columns = database
        .query<{ name: string }, []>("PRAGMA table_info(sessions)")
        .all()
      const hasColumn = columns.some((col) => col.name === "ai_session_data")

      if (!hasColumn) {
        database.exec("ALTER TABLE sessions ADD COLUMN ai_session_data TEXT")
      }

      // Update version
      database.exec("INSERT OR REPLACE INTO schema_version (version) VALUES (2)")
    }

    // Migration to version 3: Add issue_comments column
    if (version < 3) {
      const columns = database
        .query<{ name: string }, []>("PRAGMA table_info(sessions)")
        .all()
      const hasColumn = columns.some((col) => col.name === "issue_comments")

      if (!hasColumn) {
        database.exec("ALTER TABLE sessions ADD COLUMN issue_comments TEXT NOT NULL DEFAULT '[]'")
      }

      database.exec("INSERT OR REPLACE INTO schema_version (version) VALUES (3)")
    }

    // Add future migrations here:
    // if (version < 4) { migrateTo4() }
  }

  const withTransaction = <T>(fn: () => T): T => {
    const database = getDatabase()
    return database.transaction(fn)()
  }

  return {
    getDatabase,
    initDatabase,
    initDatabaseWithPath,
    closeDatabase,
    isDatabaseInitialized,
    getDatabasePath,
    getSchemaVersion,
    runMigrations,
    withTransaction,
  }
}

// ============================================================================
// Active Database Manager
// ============================================================================

let activeManager = createDatabaseManager()

export function setDatabaseManager(manager: DatabaseManager): void {
  activeManager = manager
}

// ============================================================================
// Default Manager Exports
// ============================================================================

export function getDatabase(): Database {
  return activeManager.getDatabase()
}

export async function initDatabase(projectRoot: string): Promise<void> {
  return activeManager.initDatabase(projectRoot)
}

export async function initDatabaseWithPath(dbPath: string): Promise<void> {
  return activeManager.initDatabaseWithPath(dbPath)
}

export function closeDatabase(): void {
  return activeManager.closeDatabase()
}

export function isDatabaseInitialized(): boolean {
  return activeManager.isDatabaseInitialized()
}

export function getDatabasePath(): string | null {
  return activeManager.getDatabasePath()
}

export function getSchemaVersion(): number {
  return activeManager.getSchemaVersion()
}

export function runMigrations(): void {
  return activeManager.runMigrations()
}

export function withTransaction<T>(fn: () => T): T {
  return activeManager.withTransaction(fn)
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate an ISO timestamp for the current time
 */
export function nowISO(): string {
  return new Date().toISOString()
}
