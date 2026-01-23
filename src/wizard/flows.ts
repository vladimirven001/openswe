/**
 * Wizard flows
 *
 * Orchestrates the first-run wizard based on workspace type.
 * Coordinates prompts, validation, cloning, and configuration saving.
 */

import {
  promptRepoInput,
  promptAiBackend,
  promptMaxSessions,
  promptAutoPr,
  promptAdoptRepo,
  promptFetchIssues,
  isCancelled,
  intro,
  outro,
  note,
  spinner,
  logError,
  logSuccess,
  logWarning,
  type AIBackendChoice,
} from "./prompts"
import { checkGhCli, validateGhRepo } from "../github/client"
import { cloneRepo, isValidOwnerRepo, getCloneUrl } from "../git/repo"
import { initProject } from "../workspace/init"
import {
  saveProjectConfig,
  createProjectConfig,
} from "../workspace/project"
import { saveGlobalConfig } from "../config/global"
import type { PartialConfig } from "../config/types"
import { fetchIssues } from "../github"

// ============================================================================
// Types
// ============================================================================

/** Result of a wizard flow */
export interface WizardResult {
  /** Whether the wizard completed successfully */
  completed: boolean
  /** Whether the user cancelled the wizard */
  cancelled: boolean
  /** Error message if the wizard failed */
  error?: string
  /** Repository full name (owner/repo) if set */
  repoFullName?: string
  /** Selected AI backend */
  aiBackend?: AIBackendChoice
  /** Selected max sessions */
  maxSessions?: number
  /** Selected auto PR setting */
  autoPr?: boolean
}

// ============================================================================
// Prerequisite Checks
// ============================================================================

/**
 * Check prerequisites for the wizard (gh CLI)
 * Returns true if all prerequisites are met
 */
async function checkPrerequisites(): Promise<{ ok: boolean; error?: string }> {
  const ghCheck = await checkGhCli()

  if (!ghCheck.installed) {
    return {
      ok: false,
      error: ghCheck.error ?? "GitHub CLI (gh) is not installed.",
    }
  }

  if (!ghCheck.authenticated) {
    return {
      ok: false,
      error: ghCheck.error ?? "Not authenticated with GitHub CLI.",
    }
  }

  return { ok: true }
}

// ============================================================================
// Empty Directory Flow
// ============================================================================

/**
 * Run the wizard for an empty directory
 *
 * This flow:
 * 1. Validates prerequisites (gh CLI)
 * 2. Prompts for repository (or uses --repo flag value)
 * 3. Validates the repository exists
 * 4. Clones the repository
 * 5. Prompts for configuration (AI backend, max sessions, auto PR)
 * 6. Saves configuration
 *
 * @param cwd - Current working directory (empty directory)
 * @param cliRepo - Repository from --repo flag (optional)
 */
export async function runEmptyDirectoryWizard(
  cwd: string,
  cliRepo?: string
): Promise<WizardResult> {
  intro("OpenSWE Setup")

  // Check prerequisites
  const prereq = await checkPrerequisites()
  if (!prereq.ok) {
    logError(prereq.error!)
    return { completed: false, cancelled: false, error: prereq.error }
  }

  // Get repository (from flag or prompt)
  let repoFullName: string

  if (cliRepo) {
    // Validate format
    if (!isValidOwnerRepo(cliRepo)) {
      logError(`Invalid repository format: ${cliRepo}`)
      return {
        completed: false,
        cancelled: false,
        error: "Invalid repository format. Use owner/repo format.",
      }
    }
    repoFullName = cliRepo
    note(`Repository: ${repoFullName}`, "From --repo flag")
  } else {
    // Prompt for repository
    const repoResult = await promptRepoInput()
    if (isCancelled(repoResult)) {
      return { completed: false, cancelled: true }
    }
    repoFullName = repoResult
  }

  // Validate repository exists and is accessible
  const s = spinner()
  s.start(`Validating repository ${repoFullName}...`)

  const validation = await validateGhRepo(repoFullName)

  if (!validation.exists || !validation.accessible) {
    s.stop(`Repository validation failed`)
    logError(validation.error ?? `Cannot access repository: ${repoFullName}`)
    return {
      completed: false,
      cancelled: false,
      error: validation.error ?? "Repository validation failed",
    }
  }

  s.stop(`Repository validated: ${repoFullName}`)

  if (validation.isPrivate) {
    note("This is a private repository", "Access")
  }

  // Clone repository
  s.start(`Cloning ${repoFullName}...`)

  const cloneResult = await cloneRepo(repoFullName, cwd, {
    protocol: "ssh",
    onProgress: (msg) => s.message(msg),
  })

  if (!cloneResult.success) {
    s.stop("Clone failed")

    // Suggest HTTPS if SSH failed
    if (cloneResult.error?.includes("Permission denied")) {
      logWarning("SSH clone failed. Trying HTTPS...")

      s.start(`Cloning ${repoFullName} via HTTPS...`)
      const httpsResult = await cloneRepo(repoFullName, cwd, {
        protocol: "https",
        onProgress: (msg) => s.message(msg),
      })

      if (!httpsResult.success) {
        s.stop("HTTPS clone also failed")
        logError(httpsResult.error ?? "Clone failed")
        return {
          completed: false,
          cancelled: false,
          error: httpsResult.error ?? "Clone failed",
        }
      }
      s.stop(`Cloned ${repoFullName}`)
    } else {
      logError(cloneResult.error ?? "Clone failed")
      return {
        completed: false,
        cancelled: false,
        error: cloneResult.error ?? "Clone failed",
      }
    }
  } else {
    s.stop(`Cloned ${repoFullName}`)
  }

  // Now gather configuration preferences
  const configResult = await gatherConfiguration()
  if (configResult.cancelled) {
    return { completed: false, cancelled: true }
  }

  // Initialize project
  s.start("Initializing OpenSWE project...")

  const repoUrl = getCloneUrl(repoFullName, "ssh")
  await initProject(cwd, { fullName: repoFullName, remoteUrl: repoUrl })

  // Save project config
  const projectConfig = createProjectConfig(repoFullName, repoUrl, {
    maxActiveSessions: configResult.maxSessions,
  })
  await saveProjectConfig(cwd, projectConfig)

  // Save global config
  const globalConfig: PartialConfig = {
    ai: { backend: configResult.aiBackend },
    defaults: { maxActiveSessions: configResult.maxSessions },
    pr: { autoCreate: configResult.autoPr },
  }
  await saveGlobalConfig(globalConfig)

  s.stop("Project initialized")

  logSuccess("Created .openswe/ directory")
  logSuccess("Created .worktrees/ directory")
  logSuccess("Updated .gitignore")
  logSuccess("Saved configuration")

  outro("Setup complete! OpenSWE is ready to use.")

  return {
    completed: true,
    cancelled: false,
    repoFullName,
    aiBackend: configResult.aiBackend,
    maxSessions: configResult.maxSessions,
    autoPr: configResult.autoPr,
  }
}

// ============================================================================
// Existing Repository Flow
// ============================================================================

/**
 * Run the wizard for an existing git repository
 *
 * This flow:
 * 1. Asks user to confirm adoption
 * 2. Prompts for configuration
 * 3. Initializes OpenSWE project
 * 4. Saves configuration
 *
 * @param cwd - Current working directory (git repo)
 * @param repoFullName - Repository name in owner/repo format
 * @param remoteUrl - Git remote URL (optional)
 */
export async function runExistingRepoWizard(
  cwd: string,
  repoFullName: string,
  remoteUrl?: string
): Promise<WizardResult> {
  intro("OpenSWE Setup")

  const prereq = await checkPrerequisites()
  if (!prereq.ok) {
    logError(prereq.error!)
    return { completed: false, cancelled: false, error: prereq.error }
  }

  note(`Repository: ${repoFullName}`, "Detected")

  // Ask to adopt
  const adopt = await promptAdoptRepo(repoFullName)
  if (isCancelled(adopt)) {
    return { completed: false, cancelled: true }
  }

  if (!adopt) {
    outro("Setup cancelled.")
    return { completed: false, cancelled: true }
  }

  // Ask permission to fetch issues immediately
  const fetchConsent = await promptFetchIssues(repoFullName)
  if (isCancelled(fetchConsent)) {
    return { completed: false, cancelled: true }
  }

  if (fetchConsent) {
    const issueSpinner = spinner()
    issueSpinner.start("Fetching GitHub issues...")

    const issuesResult = await fetchIssues(repoFullName, { state: "open", limit: 30 })

    if (issuesResult.success) {
      issueSpinner.stop(`Fetched ${issuesResult.issues.length} issues`)
      if (issuesResult.issues.length === 0) {
        note("No issues found. You can fetch again later from the TUI.", "Issues")
      }
    } else {
      issueSpinner.stop("Issue fetch skipped")
      logWarning(issuesResult.error ?? "Failed to fetch issues")
    }
  } else {
    note("Issue fetching skipped. You can load issues later from the TUI.", "Skipped")
  }

  // Gather configuration
  const configResult = await gatherConfiguration()
  if (configResult.cancelled) {
    return { completed: false, cancelled: true }
  }

  // Initialize project
  const s = spinner()
  s.start("Initializing OpenSWE project...")

  const repoUrl = remoteUrl ?? getCloneUrl(repoFullName, "ssh")
  await initProject(cwd, { fullName: repoFullName, remoteUrl: repoUrl })

  // Save project config
  const projectConfig = createProjectConfig(repoFullName, repoUrl, {
    maxActiveSessions: configResult.maxSessions,
  })
  await saveProjectConfig(cwd, projectConfig)

  // Save global config
  const globalConfig: PartialConfig = {
    ai: { backend: configResult.aiBackend },
    defaults: { maxActiveSessions: configResult.maxSessions },
    pr: { autoCreate: configResult.autoPr },
  }
  await saveGlobalConfig(globalConfig)

  s.stop("Project initialized")

  logSuccess("Created .openswe/ directory")
  logSuccess("Created .worktrees/ directory")
  logSuccess("Updated .gitignore")
  logSuccess("Saved configuration")

  outro("Setup complete! OpenSWE is ready to use.")

  return {
    completed: true,
    cancelled: false,
    repoFullName,
    aiBackend: configResult.aiBackend,
    maxSessions: configResult.maxSessions,
    autoPr: configResult.autoPr,
  }
}

// ============================================================================
// Configuration Gathering
// ============================================================================

interface ConfigurationResult {
  cancelled: boolean
  aiBackend?: AIBackendChoice
  maxSessions?: number
  autoPr?: boolean
}

/**
 * Gather configuration preferences from the user
 */
async function gatherConfiguration(): Promise<ConfigurationResult> {
  // AI backend
  const backend = await promptAiBackend()
  if (isCancelled(backend)) {
    return { cancelled: true }
  }

  // Max sessions
  const maxSessions = await promptMaxSessions()
  if (isCancelled(maxSessions)) {
    return { cancelled: true }
  }

  // Auto PR
  const autoPr = await promptAutoPr()
  if (isCancelled(autoPr)) {
    return { cancelled: true }
  }

  return {
    cancelled: false,
    aiBackend: backend,
    maxSessions,
    autoPr,
  }
}

// ============================================================================
// Reconfiguration Flow
// ============================================================================

/**
 * Re-run configuration for an existing project (--setup flag)
 *
 * @param cwd - Project root directory
 * @param repoFullName - Repository name
 */
export async function runReconfigureWizard(
  cwd: string,
  repoFullName: string
): Promise<WizardResult> {
  intro("OpenSWE Reconfiguration")

  const prereq = await checkPrerequisites()
  if (!prereq.ok) {
    logError(prereq.error!)
    return { completed: false, cancelled: false, error: prereq.error }
  }

  note(`Repository: ${repoFullName}`, "Current Project")

  // Gather configuration
  const configResult = await gatherConfiguration()
  if (configResult.cancelled) {
    return { completed: false, cancelled: true }
  }

  // Update global config
  const s = spinner()
  s.start("Saving configuration...")

  const globalConfig: PartialConfig = {
    ai: { backend: configResult.aiBackend },
    defaults: { maxActiveSessions: configResult.maxSessions },
    pr: { autoCreate: configResult.autoPr },
  }
  await saveGlobalConfig(globalConfig)

  s.stop("Configuration saved")

  outro("Reconfiguration complete!")

  return {
    completed: true,
    cancelled: false,
    repoFullName,
    aiBackend: configResult.aiBackend,
    maxSessions: configResult.maxSessions,
    autoPr: configResult.autoPr,
  }
}
