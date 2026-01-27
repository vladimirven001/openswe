/**
 * Project configuration
 *
 * Handles local project-specific state stored in .openswe/project.json.
 * This is separate from the global config (~/.config/openswe/config.toml)
 * and stores project-specific information like linked repo details.
 */

import { join } from "path"
import { getOpenSWEDir } from "./paths"

// ============================================================================
// Types
// ============================================================================

/** Local project configuration stored in .openswe/project.json */
export interface ProjectConfig {
  /** Full repository name in owner/repo format */
  repoFullName: string
  /** Git remote URL (SSH or HTTPS format) */
  repoUrl: string
  /** ISO timestamp when project was created */
  createdAt: string
  /** ISO timestamp when project was last opened */
  lastOpenedAt: string
}

/** Project config file name */
const PROJECT_CONFIG_FILE = "project.json"

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Get the path to the project config file
 * @param projectRoot - Absolute path to the project root
 */
export function getProjectConfigPath(projectRoot: string): string {
  return join(getOpenSWEDir(projectRoot), PROJECT_CONFIG_FILE)
}

// ============================================================================
// Load/Save Functions
// ============================================================================

/**
 * Load project configuration from .openswe/project.json
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Project config or null if file doesn't exist or is invalid
 */
export async function loadProjectConfig(projectRoot: string): Promise<ProjectConfig | null> {
  const configPath = getProjectConfigPath(projectRoot)

  try {
    const file = Bun.file(configPath)
    if (!(await file.exists())) {
      return null
    }

    const content = await file.text()
    const parsed = JSON.parse(content) as unknown

    // Basic validation
    if (!isValidProjectConfig(parsed)) {
      console.warn(`[OpenSWE] Invalid project config at ${configPath}`)
      return null
    }

    return parsed
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.warn(`[OpenSWE] Failed to parse project config at ${configPath}: Invalid JSON`)
    }
    return null
  }
}

/**
 * Save project configuration to .openswe/project.json
 *
 * @param projectRoot - Absolute path to the project root
 * @param config - Project configuration to save
 */
export async function saveProjectConfig(
  projectRoot: string,
  config: ProjectConfig
): Promise<void> {
  const configPath = getProjectConfigPath(projectRoot)

  const content = JSON.stringify(config, null, 2)
  await Bun.write(configPath, content)
}

/**
 * Update the lastOpenedAt timestamp in the project config
 *
 * @param projectRoot - Absolute path to the project root
 */
export async function updateLastOpened(projectRoot: string): Promise<void> {
  const config = await loadProjectConfig(projectRoot)
  if (!config) {
    return // No config to update
  }

  config.lastOpenedAt = new Date().toISOString()
  await saveProjectConfig(projectRoot, config)
}

/**
 * Create a new project config with default values
 *
 * @param repoFullName - Repository in owner/repo format
 * @param repoUrl - Git remote URL
 * @param options - Optional overrides
 */
export function createProjectConfig(
  repoFullName: string,
  repoUrl: string,
): ProjectConfig {
  const now = new Date().toISOString()
  return {
    repoFullName,
    repoUrl,
    createdAt: now,
    lastOpenedAt: now,
  }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Type guard to validate project config structure
 */
function isValidProjectConfig(value: unknown): value is ProjectConfig {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const obj = value as Record<string, unknown>

  return (
    typeof obj.repoFullName === "string" &&
    obj.repoFullName.length > 0 &&
    typeof obj.repoUrl === "string" &&
    obj.repoUrl.length > 0 &&
    typeof obj.createdAt === "string" &&
    typeof obj.lastOpenedAt === "string"
  )
}

/**
 * Check if a project config file exists
 *
 * @param projectRoot - Absolute path to the project root
 */
export async function projectConfigExists(projectRoot: string): Promise<boolean> {
  const configPath = getProjectConfigPath(projectRoot)
  const file = Bun.file(configPath)
  return file.exists()
}
