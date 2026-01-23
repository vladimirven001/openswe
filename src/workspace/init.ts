/**
 * Project initialization
 *
 * Handles creating and setting up a new OpenSWE project:
 * - Create .openswe/ directory structure
 * - Update .gitignore
 * - (Database initialization is handled in Phase 5)
 */

import { join } from "path"
import { mkdir } from "fs/promises"
import {
  getOpenSWEDir,
  getWorktreesDir,
  getLogsDir,
  OPENSWE_DIR,
  WORKTREES_DIR,
} from "./paths"

// ============================================================================
// Types
// ============================================================================

/** Information about the repository being linked */
export interface RepoInfo {
  /** Full repository name in owner/repo format */
  fullName: string
  /** Git remote URL (SSH or HTTPS) */
  remoteUrl: string
}

/** Result of project initialization */
export interface InitResult {
  /** Absolute path to the project root */
  projectRoot: string
  /** Path to .openswe directory */
  opensweDir: string
  /** Path to .worktrees directory */
  worktreesDir: string
  /** Whether .gitignore was updated */
  gitignoreUpdated: boolean
}

// ============================================================================
// Gitignore Entries
// ============================================================================

/** Lines to add to .gitignore */
const GITIGNORE_ENTRIES = `
# OpenSWE
${OPENSWE_DIR}/
${WORKTREES_DIR}/
`

/** Header comment for OpenSWE section in .gitignore */
const GITIGNORE_HEADER = "# OpenSWE"

// ============================================================================
// Directory Creation
// ============================================================================

/**
 * Create the .openswe directory structure
 * @param projectRoot - Absolute path to the project root
 */
export async function createOpenSWEDirectory(projectRoot: string): Promise<void> {
  const opensweDir = getOpenSWEDir(projectRoot)
  const logsDir = getLogsDir(projectRoot)

  // Create .openswe/ and .openswe/logs/
  await mkdir(opensweDir, { recursive: true })
  await mkdir(logsDir, { recursive: true })
}

/**
 * Create the .worktrees directory
 * @param projectRoot - Absolute path to the project root
 */
export async function createWorktreesDirectory(projectRoot: string): Promise<void> {
  const worktreesDir = getWorktreesDir(projectRoot)
  await mkdir(worktreesDir, { recursive: true })
}

// ============================================================================
// Gitignore Management
// ============================================================================

/**
 * Check if .gitignore already contains OpenSWE entries
 * @param content - Current .gitignore content
 */
function hasOpenSWEEntries(content: string): boolean {
  return content.includes(GITIGNORE_HEADER) ||
         content.includes(`${OPENSWE_DIR}/`) ||
         content.includes(`${WORKTREES_DIR}/`)
}

/**
 * Update .gitignore to include OpenSWE entries
 * Creates the file if it doesn't exist
 *
 * @param projectRoot - Absolute path to the project root
 * @returns true if file was updated, false if already had entries
 */
export async function updateGitignore(projectRoot: string): Promise<boolean> {
  const gitignorePath = join(projectRoot, ".gitignore")
  const file = Bun.file(gitignorePath)

  let existingContent = ""
  if (await file.exists()) {
    existingContent = await file.text()
  }

  // Check if already has our entries
  if (hasOpenSWEEntries(existingContent)) {
    return false
  }

  // Append our entries (with a newline separator if file has content)
  const separator = existingContent.length > 0 && !existingContent.endsWith("\n")
    ? "\n"
    : ""
  const newContent = existingContent + separator + GITIGNORE_ENTRIES.trimStart()

  await Bun.write(gitignorePath, newContent)
  return true
}

// ============================================================================
// Full Initialization
// ============================================================================

/**
 * Initialize a new OpenSWE project
 *
 * This creates the necessary directory structure and updates .gitignore.
 * Note: Database initialization is handled separately in Phase 5.
 *
 * @param projectRoot - Absolute path to the project root
 * @param repoInfo - Information about the repository (optional, for logging)
 * @returns Initialization result
 */
export async function initProject(
  projectRoot: string,
  repoInfo?: RepoInfo
): Promise<InitResult> {
  const opensweDir = getOpenSWEDir(projectRoot)
  const worktreesDir = getWorktreesDir(projectRoot)

  // Create directory structure
  await createOpenSWEDirectory(projectRoot)
  await createWorktreesDirectory(projectRoot)

  // Update .gitignore
  const gitignoreUpdated = await updateGitignore(projectRoot)

  return {
    projectRoot,
    opensweDir,
    worktreesDir,
    gitignoreUpdated,
  }
}

/**
 * Check if a project is fully initialized
 * (has .openswe directory with required structure)
 *
 * @param projectRoot - Absolute path to the project root
 */
export async function isProjectInitialized(projectRoot: string): Promise<boolean> {
  const opensweDir = getOpenSWEDir(projectRoot)

  try {
    const { stat } = await import("fs/promises")
    const stats = await stat(opensweDir)
    return stats.isDirectory()
  } catch {
    return false
  }
}

/**
 * Clean up a partially initialized project
 * (removes .openswe and .worktrees directories)
 *
 * Use with caution - this is destructive!
 *
 * @param projectRoot - Absolute path to the project root
 */
export async function cleanupProject(projectRoot: string): Promise<void> {
  const { rm } = await import("fs/promises")

  const opensweDir = getOpenSWEDir(projectRoot)
  const worktreesDir = getWorktreesDir(projectRoot)

  // Remove directories (ignore errors if they don't exist)
  await rm(opensweDir, { recursive: true, force: true })
  await rm(worktreesDir, { recursive: true, force: true })
}
