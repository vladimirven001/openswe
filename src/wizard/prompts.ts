/**
 * Wizard prompts
 *
 * Individual prompt components using @clack/prompts for the first-run wizard.
 */

import * as p from "@clack/prompts"
import { isValidOwnerRepo } from "../git/repo"

// ============================================================================
// Types
// ============================================================================

/** AI backend options */
export type AIBackendChoice = "opencode" | "claude"

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
    ],
  })

  return backend
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
    message: `Initialize OpenSWE for ${repoName}?`,
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
