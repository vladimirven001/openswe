/**
 * Prerequisites checker for OpenSWE
 *
 * Verifies required tools are installed before starting the TUI.
 */

import { checkGitInstalled } from "../git"
import { checkGhCli } from "../github"
import type { AIBackend } from "../config/types"

// ============================================================================
// Types
// ============================================================================

/** Result of prerequisite checks */
export interface PrerequisiteResult {
  /** Whether all prerequisites are met */
  success: boolean
  /** List of error messages for unmet prerequisites */
  errors: string[]
  /** List of warning messages (non-fatal) */
  warnings: string[]
}

// ============================================================================
// Prerequisite Checks
// ============================================================================

/**
 * Check all prerequisites for running OpenSWE
 *
 * Verifies:
 * - Git is installed
 * - GitHub CLI (gh) is installed and authenticated
 * - The configured AI backend CLI is available
 *
 * @param backend - The configured AI backend to check (defaults to "opencode")
 * @returns Result indicating whether prerequisites are met
 */
export async function checkPrerequisites(backend: AIBackend = "opencode"): Promise<PrerequisiteResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // Check git installation
  const gitInstalled = await checkGitInstalled()
  if (!gitInstalled) {
    errors.push("Git is not installed. Install it from https://git-scm.com/")
  }

  // Check gh CLI installation and authentication
  const ghResult = await checkGhCli()
  if (!ghResult.installed) {
    errors.push(
      "GitHub CLI (gh) is not installed. Install it from https://cli.github.com/"
    )
  } else if (!ghResult.authenticated) {
    errors.push(
      ghResult.error ?? "Not authenticated with GitHub. Run: gh auth login"
    )
  }

  // Check if the configured backend CLI is available (warning only)
  const backendCommand = backend === "opencode" ? "opencode" : backend === "claude" ? "claude" : "codex"
  const backendAvailable = await isCommandAvailable(backendCommand)
  if (!backendAvailable) {
    warnings.push(
      `${backendCommand} command not found in PATH. Sessions won't be able to start until it's installed.`
    )
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Check if a command is available in PATH
 *
 * @param command - Command name to check
 * @returns True if command is available
 */
async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", command], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const exitCode = await proc.exited
    return exitCode === 0
  } catch {
    return false
  }
}

/**
 * Format prerequisite errors for display
 *
 * @param result - Prerequisite check result
 * @returns Formatted string for console output
 */
export function formatPrerequisiteErrors(result: PrerequisiteResult): string {
  const lines: string[] = []

  if (result.errors.length > 0) {
    lines.push("Prerequisites not met:")
    for (const error of result.errors) {
      lines.push(`  - ${error}`)
    }
  }

  if (result.warnings.length > 0) {
    if (lines.length > 0) lines.push("")
    lines.push("Warnings:")
    for (const warning of result.warnings) {
      lines.push(`  - ${warning}`)
    }
  }

  return lines.join("\n")
}
