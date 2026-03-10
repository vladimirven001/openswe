/**
 * Wizard prompts
 *
 * Individual prompt components using @clack/prompts for the first-run wizard.
 */

import * as p from "@clack/prompts"
import { isValidOwnerRepo } from "../git/repo"
import { getProvider } from "../providers"

// ============================================================================
// Types
// ============================================================================

/** AI backend options */
export type AIBackendChoice = "opencode" | "claude" | "codex"

// ============================================================================
// Repository Input
// ============================================================================

/**
 * Prompt the user for a GitHub repository in owner/repo format
 *
 * @returns The repository string or a symbol if cancelled
 */
export async function promptRepoInput(): Promise<string | symbol> {
  const repo = await p.text({
    message: "Enter GitHub repository (owner/repo):",
    placeholder: "owner/repo",
    validate: (value) => {
      if (!value.trim()) {
        return "Repository is required"
      }
      if (!isValidOwnerRepo(value.trim())) {
        return "Please enter a valid repository in owner/repo format"
      }
    },
  })

  if (typeof repo === "string") {
    return repo.trim()
  }
  return repo
}

// ============================================================================
// AI Backend Selection
// ============================================================================

/**
 * Prompt the user to select an AI backend
 *
 * @returns The selected backend or a symbol if cancelled
 */
export async function promptAiBackend(): Promise<AIBackendChoice | symbol> {
  const backend = await p.select({
    message: "Select AI backend:",
    options: [
      {
        value: "opencode" as const,
        label: "OpenCode",
        hint: "Open-source, self-hosted AI agents",
      },
      {
        value: "claude" as const,
        label: "Claude",
        hint: "Anthropic's Claude via API",
      },
      {
        value: "codex" as const,
        label: "Codex",
        hint: "OpenAI's coding agent CLI",
      },
    ],
  })

  return backend
}

/**
 * Prompt the user to select an AI backend and keep retrying until it is installed
 *
 * Loops until the user selects a valid installed backend or cancels the prompt.
 *
 * @returns The selected installed backend or a symbol if cancelled
 */
export async function promptAiBackendWithValidation(): Promise<AIBackendChoice | symbol> {
  while (true) {
    const backend = await promptAiBackend()
    if (isCancelled(backend)) {
      return backend
    }

    const provider = getProvider(backend as AIBackendChoice)
    const isInstalled = await provider.validateInstallation()

    if (isInstalled) {
      return backend
    }

    const installUrl = provider.branding.installationUrl ?? "the official documentation"
    p.log.error(`${provider.branding.displayName} is not installed.`)
    p.log.info(`Please install it from: ${installUrl}`)
    p.log.message("")
  }
}

// ============================================================================
// Repository Adoption
// ============================================================================

/**
 * Prompt to adopt an existing repository
 *
 * @param repoName - The repository name to display
 * @returns true/false or a symbol if cancelled
 */
export async function promptAdoptRepo(repoName: string): Promise<boolean | symbol> {
  const adopt = await p.confirm({
    message: `Initialize openswe for ${repoName}?`,
    initialValue: true,
  })

  return adopt
}

// =========================================================================
// Issue Fetch Consent
// =========================================================================

/**
 * Ask for permission to fetch GitHub issues for a detected repository
 */
export async function promptFetchIssues(repoName: string): Promise<boolean | symbol> {
  const consent = await p.confirm({
    message: `Fetch GitHub issues for ${repoName}?`,
    initialValue: true,
  })

  return consent
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a prompt result indicates cancellation
 */
export function isCancelled(value: unknown): value is symbol {
  return p.isCancel(value)
}

/**
 * Display an intro message
 */
export function intro(message: string): void {
  p.intro(message)
}

/**
 * Display an outro message
 */
export function outro(message: string): void {
  p.outro(message)
}

/**
 * Display a note
 */
export function note(message: string, title?: string): void {
  p.note(message, title)
}

/**
 * Display a cancellation message and exit
 */
export function handleCancel(message = "Setup cancelled."): never {
  p.cancel(message)
  process.exit(0)
}

/**
 * Create a spinner for long-running operations
 */
export function spinner(): ReturnType<typeof p.spinner> {
  return p.spinner()
}

/**
 * Log a message (styled)
 */
export function log(message: string): void {
  p.log.message(message)
}

/**
 * Log an info message
 */
export function logInfo(message: string): void {
  p.log.info(message)
}

/**
 * Log a success message
 */
export function logSuccess(message: string): void {
  p.log.success(message)
}

/**
 * Log a warning message
 */
export function logWarning(message: string): void {
  p.log.warn(message)
}

/**
 * Log an error message
 */
export function logError(message: string): void {
  p.log.error(message)
}
