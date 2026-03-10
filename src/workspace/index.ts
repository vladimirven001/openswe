/**
 * Workspace module
 *
 * Provides utilities for workspace detection and initialization:
 * - Path utilities for .openswe/, .worktrees/, etc.
 * - Workspace type detection (existing-project, existing-repo, empty)
 * - Project initialization (directory creation)
 */

// Re-export all path utilities
export {
  // Constants
  OPENSWE_DIR,
  WORKTREES_DIR,
  STATE_DB_FILE,
  LOGS_DIR,
  // Path resolution
  getOpensweDir,
  getWorktreesDir,
  getStateDatabasePath,
  getLogsDir,
  getWorktreePath,
  // Naming utilities
  sanitizeWorktreeName,
  generateBranchName,
  // Path validation
  ensureAbsolutePath,
  isPathInside,
} from "./paths"

// Re-export detection utilities
export {
  // Types
  type WorkspaceType,
  type WorkspaceResult,
  // Detection functions
  detectWorkspace,
  hasOpensweProject,
  hasGitRepo,
  isEmptyDirectory,
  getGitRemoteUrl,
  parseRepoFullName,
  validateWorkspaceDirectory,
} from "./detect"

// Re-export initialization utilities
export {
  // Types
  type RepoInfo,
  type InitResult,
  // Initialization functions
  initProject,
  createOpensweDirectory,
  createWorktreesDirectory,
  isProjectInitialized,
  cleanupProject,
} from "./init"

// Re-export project config utilities
export {
  // Types
  type ProjectConfig,
  // Path utilities
  getProjectConfigPath,
  // CRUD functions
  loadProjectConfig,
  saveProjectConfig,
  updateLastOpened,
  createProjectConfig,
  projectConfigExists,
} from "./project"
