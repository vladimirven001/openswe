/**
 * Wizard flows
 *
 * Orchestrates the first-run wizard based on workspace type.
 * Coordinates prompts, validation, cloning, and configuration saving.
 */

import {
  promptRepoInput,
  promptAiBackendWithValidation,
  promptAdoptRepo,
  promptFetchIssues,
  promptTicketProvider,
  promptDeleteOldSessions,
  isCancelled,
  intro,
  outro,
  note,
  spinner,
  logError,
  logSuccess,
  logWarning,
  type AIBackendChoice,
  type TicketProviderChoice,
} from "./prompts"
import { checkGhCli, validateGhRepo } from "../github/client"
import { cloneRepo, isValidOwnerRepo, getCloneUrl } from "../git/repo"
import { initProject } from "../workspace/init"
import {
  saveProjectConfig,
  createProjectConfig,
  loadProjectConfig,
} from "../workspace/project"
import { saveGlobalConfig } from "../config/global"
import type { PartialConfig } from "../config/types"
import { fetchIssues } from "../github"
import { getTicketProvider } from "../tickets"
import { deleteSessionsByTicketProvider, getSessionCountByTicketProvider, initDatabaseWithPath, updateProjectTicketProvider } from "../store"
import { getStateDatabasePath } from "../workspace/paths"
import { logger } from "../utils/logger"

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
  /** Selected ticket provider */
  ticketProvider?: TicketProviderChoice
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
 * 5. Prompts for configuration (AI backend)
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
  const projectConfig = createProjectConfig(
    repoFullName,
    repoUrl,
    configResult.ticketProvider
  )
  await saveProjectConfig(cwd, projectConfig)

  // Save global config
  const globalConfig: PartialConfig = {
    ai: { backend: configResult.aiBackend },
  }
  await saveGlobalConfig(globalConfig)

  s.stop("Project initialized")

  logSuccess("Created .openswe/ directory")
  logSuccess("Created .worktrees/ directory")
  logSuccess("Saved configuration")

  outro("Setup complete! OpenSWE is ready to use.")

  return {
    completed: true,
    cancelled: false,
    repoFullName,
    aiBackend: configResult.aiBackend,
    ticketProvider: configResult.ticketProvider,
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

  // Gather configuration (AI backend + ticket provider)
  const configResult = await gatherConfiguration()
  if (configResult.cancelled) {
    return { completed: false, cancelled: true }
  }

  // Ask permission to fetch issues using selected provider
  const fetchConsent = await promptFetchIssues(repoFullName)
  if (isCancelled(fetchConsent)) {
    return { completed: false, cancelled: true }
  }

  if (fetchConsent) {
    const issueSpinner = spinner()
    issueSpinner.start("Fetching issues...")

    const provider = getTicketProvider(configResult.ticketProvider!)
    try {
      const result = await provider.fetchTickets(repoFullName, { state: "open", limit: 30 })

      if (result.success) {
        issueSpinner.stop(`Fetched ${result.tickets.length} issues`)
        if (result.tickets.length === 0) {
          note("No issues found. You can fetch again later from the TUI.", "Issues")
        }
      } else {
        issueSpinner.stop("Issue fetch skipped")
        logWarning(result.error ?? "Failed to fetch issues")
      }
    } catch (err) {
      issueSpinner.stop("Issue fetch skipped")
      logWarning(err instanceof Error ? err.message : "Failed to fetch issues")
    }
  } else {
    note("Issue fetching skipped. You can load issues later from the TUI.", "Skipped")
  }

  // Initialize project
  const s = spinner()
  s.start("Initializing OpenSWE project...")

  const repoUrl = remoteUrl ?? getCloneUrl(repoFullName, "ssh")
  await initProject(cwd, { fullName: repoFullName, remoteUrl: repoUrl })

  // Save project config
  const projectConfig = createProjectConfig(
    repoFullName,
    repoUrl,
    configResult.ticketProvider
  )
  await saveProjectConfig(cwd, projectConfig)

  // Save global config
  const globalConfig: PartialConfig = {
    ai: { backend: configResult.aiBackend },
  }
  await saveGlobalConfig(globalConfig)

  s.stop("Project initialized")

  logSuccess("Created .openswe/ directory")
  logSuccess("Created .worktrees/ directory")
  logSuccess("Saved configuration")

  outro("Setup complete! OpenSWE is ready to use.")

  return {
    completed: true,
    cancelled: false,
    repoFullName,
    aiBackend: configResult.aiBackend,
    ticketProvider: configResult.ticketProvider,
  }
}

// ============================================================================
// Configuration Gathering
// ============================================================================

interface ConfigurationResult {
  cancelled: boolean
  aiBackend?: AIBackendChoice
  ticketProvider?: TicketProviderChoice
}

/**
 * Gather configuration preferences from the user
 */
async function gatherConfiguration(): Promise<ConfigurationResult> {
  // AI backend
  const backend = await promptAiBackendWithValidation()
  if (isCancelled(backend)) {
    return { cancelled: true }
  }

  // Ticket provider
  const ticketProvider = await promptTicketProvider()
  if (isCancelled(ticketProvider)) {
    return { cancelled: true }
  }

  return {
    cancelled: false,
    aiBackend: backend,
    ticketProvider,
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

  // Initialize database for existing project
  const dbPath = getStateDatabasePath(cwd)
  await initDatabaseWithPath(dbPath)

  // Get existing config to check current ticket provider
  const existingConfig = await loadProjectConfig(cwd)
  const oldTicketProvider = existingConfig?.ticketProvider ?? "github"

  // Gather configuration (AI backend + ticket provider)
  const configResult = await gatherConfiguration()
  if (configResult.cancelled) {
    return { completed: false, cancelled: true }
  }

  // Check if ticket provider changed
  const newTicketProvider = configResult.ticketProvider!
  const providerChanged = oldTicketProvider !== newTicketProvider

  // Handle ticket provider change BEFORE persisting
  if (providerChanged) {
    const oldProviderLabel = oldTicketProvider === "github" ? "GitHub Issues" : oldTicketProvider
    const newProviderLabel = newTicketProvider === "github" ? "GitHub Issues" : newTicketProvider

    logWarning(`Ticket provider changed from ${oldProviderLabel} to ${newProviderLabel}`)

    // Check how many sessions from old provider
    const oldSessionCount = getSessionCountByTicketProvider(oldTicketProvider)

    // Offer to delete old sessions
    if (oldSessionCount > 0) {
      const deleteOld = await promptDeleteOldSessions(oldTicketProvider, oldSessionCount)

      if (isCancelled(deleteOld)) {
        return { completed: false, cancelled: true }
      }

      if (deleteOld) {
        const deleted = deleteSessionsByTicketProvider(oldTicketProvider)
        logSuccess(`Deleted ${deleted} session(s) from ${oldProviderLabel}`)
      }
    }
  }

  // Update configs
  const s = spinner()
  s.start("Saving configuration...")

  // Update global config
  const globalConfig: PartialConfig = {
    ai: { backend: configResult.aiBackend },
  }
  await saveGlobalConfig(globalConfig)

  // Update project config and database with ticket provider
  if (existingConfig && configResult.ticketProvider) {
    existingConfig.ticketProvider = configResult.ticketProvider
    await saveProjectConfig(cwd, existingConfig)
    updateProjectTicketProvider(configResult.ticketProvider)
  }

  s.stop("Configuration saved")

  // Ask to fetch issues from new provider
  const fetchConsent = await promptFetchIssues(repoFullName)
  if (isCancelled(fetchConsent)) {
    return { completed: true, cancelled: false }
  }

  if (fetchConsent) {
    const issueSpinner = spinner()
    issueSpinner.start("Fetching issues...")

    const provider = getTicketProvider(newTicketProvider)
    try {
      const result = await provider.fetchTickets(repoFullName, { state: "open", limit: 30 })

      if (result.success) {
        issueSpinner.stop(`Fetched ${result.tickets.length} issues`)
        if (result.tickets.length === 0) {
          note("No issues found. You can fetch again later from the TUI.", "Issues")
        }
      } else {
        issueSpinner.stop("Issue fetch skipped")
        logWarning(result.error ?? "Failed to fetch issues")
      }
    } catch (err) {
      issueSpinner.stop("Issue fetch skipped")
      logWarning(err instanceof Error ? err.message : "Failed to fetch issues")
    }
  } else {
    note("Issue fetching skipped. You can load issues later from the TUI.", "Skipped")
  }

  outro("Reconfiguration complete!")

  return {
    completed: true,
    cancelled: false,
    repoFullName,
    aiBackend: configResult.aiBackend,
    ticketProvider: configResult.ticketProvider,
  }
}
