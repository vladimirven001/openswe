#!/usr/bin/env bun
/**
 * OpenSWE - AI-powered Software Engineering orchestration
 *
 * Main entry point with CLI argument parsing, config loading, and workspace detection.
 */

// IMPORTANT: Must import preload before any JSX code to register Solid.js JSX runtime.
// This is needed because bunfig.toml is only read from cwd, not the package directory.
import "@opentui/solid/preload"

import { join } from "path"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { loadConfig, getConfigPath, type GlobalConfig, type AIBackend } from "./config"
import { logger, setLogLevel, initFileLogging } from "./utils/logger"
import { checkPrerequisites, formatPrerequisiteErrors } from "./utils/prerequisites"
import { closeDatabase } from "./store"
import {
  detectWorkspace,
  loadProjectConfig,
  updateLastOpened,
  getLogsDir,
  type WorkspaceResult,
} from "./workspace"
import {
  runEmptyDirectoryWizard,
  runExistingRepoWizard,
  runReconfigureWizard,
} from "./wizard"

// NOTE: startTUI is dynamically imported to ensure the preload runs first.
// Static imports are hoisted and parsed before any code executes, which would
// cause app.tsx to be parsed before the Solid.js JSX runtime is registered.

// ============================================================================
// CLI Argument Types
// ============================================================================

interface CLIArgs {
  repo?: string
  setup?: boolean
  status?: boolean
  backend?: "opencode" | "claude"
  model?: string
  debug?: boolean
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

// Parse CLI arguments
const argv = await yargs(hideBin(process.argv))
  .scriptName("openswe")
  .usage("$0 [options]")
  .option("repo", {
    alias: "r",
    type: "string",
    description: "GitHub repository (owner/repo) to link",
  })
  .option("setup", {
    type: "boolean",
    description: "Force re-run the setup wizard",
  })
  .option("status", {
    type: "boolean",
    description: "Show project status without TUI",
  })
  .option("backend", {
    type: "string",
    choices: ["opencode", "claude"] as const,
    description: "AI backend to use",
  })
  .option("model", {
    type: "string",
    description: "AI model to use (e.g. claude-3-5-sonnet-20240620)",
  })
  .option("debug", {
    type: "boolean",
    description: "Enable debug logging",
  })
  .help()
  .alias("h", "help")
  .version("0.1.0")
  .alias("v", "version")
  .parse() as CLIArgs

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  // Load configuration with CLI overrides
  const config = await loadConfig({
    backend: argv.backend as AIBackend | undefined,
    model: argv.model,
    debug: argv.debug,
  })

  // Apply log level from merged config
  setLogLevel(config.advanced.logLevel)

  logger.debug("OpenSWE starting...")
  logger.debug("Config file path:", getConfigPath())
  logger.debug("Loaded configuration:", config)

  // Detect workspace type
  const cwd = process.cwd()
  const workspace = await detectWorkspace(cwd)

  logger.debug("Workspace detection result:", workspace)

  // Show status mode (uses workspace info)
  if (argv.status) {
    await showStatus(config, workspace)
    return
  }

  // Handle workspace based on type
  await handleWorkspace(workspace, config, argv)

  exitApp(0)
}

// ============================================================================
// Exit Handling
// ============================================================================

function exitApp(code: number): never {
  try {
    closeDatabase()
  } catch {
    // Ignore close errors during shutdown
  }
  process.exit(code)
}

// ============================================================================
// Workspace Handling
// ============================================================================

/**
 * Handle the detected workspace type
 */
async function handleWorkspace(
  workspace: WorkspaceResult,
  config: GlobalConfig,
  args: CLIArgs
): Promise<void> {
  // Handle --setup flag for reconfiguration
  if (args.setup && workspace.type === "existing-project") {
    const projectConfig = await loadProjectConfig(workspace.projectRoot)
    if (projectConfig) {
      const result = await runReconfigureWizard(
        workspace.projectRoot,
        projectConfig.repoFullName
      )
    if (result.cancelled) {
      logger.info("Setup cancelled.")
      exitApp(0)
    }
    if (!result.completed) {
      logger.error("Setup failed:", result.error)
      exitApp(1)
    }
    }
    // Continue to normal project handling after reconfiguration
  }

  switch (workspace.type) {
    case "existing-project":
      await handleExistingProject(workspace, config)
      break

    case "existing-repo":
      await handleExistingRepo(workspace, args)
      break

    case "empty":
      await handleEmptyDirectory(workspace, args)
      break
  }
}

/**
 * Handle existing OpenSWE project - load and continue
 */
async function handleExistingProject(
  workspace: WorkspaceResult,
  config: GlobalConfig
): Promise<void> {
  // Initialize file logging
  const logsDir = getLogsDir(workspace.projectRoot)
  initFileLogging(join(logsDir, "openswe.log"))

  // Check prerequisites before launching TUI
  const prereqResult = await checkPrerequisites()
  if (!prereqResult.success) {
    logger.error(formatPrerequisiteErrors(prereqResult))
    exitApp(1)
  }

  // Log warnings if any
  if (prereqResult.warnings.length > 0) {
    for (const warning of prereqResult.warnings) {
      logger.warn(warning)
    }
  }

  // Load project config and update lastOpened
  const projectConfig = await loadProjectConfig(workspace.projectRoot)
  if (projectConfig) {
    await updateLastOpened(workspace.projectRoot)
    logger.debug("Project config:", projectConfig)
  }

  // Launch TUI - dynamic import to ensure preload runs first
  const { startTUI } = await import("./app")
  await startTUI(config, workspace.projectRoot)
}

/**
 * Handle existing git repo - offer to adopt
 */
async function handleExistingRepo(
  workspace: WorkspaceResult,
  args: CLIArgs
): Promise<void> {
  // If we don't have a repo name, we can't run the wizard
  if (!workspace.repoFullName) {
    logger.error("Could not detect repository name from git remote.")
    logger.error("Please ensure you have a remote named 'origin' configured.")
    exitApp(1)
  }

  // Run the adoption wizard
  const result = await runExistingRepoWizard(
    workspace.projectRoot,
    workspace.repoFullName,
    workspace.remoteUrl ?? undefined
  )

  if (result.cancelled) {
    logger.info("Setup cancelled.")
    exitApp(0)
  }

  if (!result.completed) {
    logger.error("Setup failed:", result.error)
    exitApp(1)
  }

  // Wizard completed successfully - show summary
  const updatedConfig = await loadConfig({
    backend: args.backend as AIBackend | undefined,
    debug: args.debug,
  })

  logger.debug("")
  logConfigSummary(updatedConfig)
  logger.debug("")
  logger.debug("OpenSWE initialized (Phase 4 - wizard complete)")
  logger.debug("Launching TUI...")

  await handleExistingProject(
    {
      type: "existing-project",
      projectRoot: workspace.projectRoot,
    },
    updatedConfig
  )
}

/**
 * Handle empty directory - need full setup
 */
async function handleEmptyDirectory(
  workspace: WorkspaceResult,
  args: CLIArgs
): Promise<void> {
  // Run the empty directory wizard
  const result = await runEmptyDirectoryWizard(workspace.projectRoot, args.repo)

  if (result.cancelled) {
    logger.info("Setup cancelled.")
    exitApp(0)
  }

  if (!result.completed) {
    logger.error("Setup failed:", result.error)
    exitApp(1)
  }

  // Wizard completed successfully - show summary
  const updatedConfig = await loadConfig({
    backend: args.backend as AIBackend | undefined,
    debug: args.debug,
  })

  logger.info("")
  logConfigSummary(updatedConfig)
  logger.info("")
  logger.info("OpenSWE initialized (Phase 4 - wizard complete)")
  logger.info("Launching TUI...")

  await handleExistingProject(
    {
      type: "existing-project",
      projectRoot: workspace.projectRoot,
    },
    updatedConfig
  )
}

// ============================================================================
// Status Display
// ============================================================================

/**
 * Show project status (non-TUI mode)
 */
async function showStatus(config: GlobalConfig, workspace: WorkspaceResult): Promise<void> {
  console.log("OpenSWE Status")
  console.log("==============")
  console.log("")
  console.log("Configuration:")
  console.log(`  Config file: ${getConfigPath()}`)
  console.log(`  AI Backend: ${config.ai.backend}`)
  console.log(`  Log Level: ${config.advanced.logLevel}`)
  console.log("")
  console.log("Workspace:")
  console.log(`  Type: ${workspace.type}`)
  console.log(`  Path: ${workspace.projectRoot}`)

  if (workspace.type === "existing-repo" && workspace.repoFullName) {
    console.log(`  Repository: ${workspace.repoFullName}`)
  }

  if (workspace.type === "existing-project") {
    console.log("  Status: Initialized")
    // TODO: Phase 5 - show session count, active tasks, etc.
  } else if (workspace.type === "existing-repo") {
    console.log("  Status: Git repo detected (not yet initialized)")
  } else {
    console.log("  Status: Empty directory (needs setup)")
  }

  console.log("")
}

/**
 * Log configuration summary
 */
function logConfigSummary(config: GlobalConfig): void {
  logger.debug("Configuration:")
  logger.debug(`  AI Backend: ${config.ai.backend}`)
  logger.debug(`  Log Level: ${config.advanced.logLevel}`)
}

// ============================================================================
// Entry Point
// ============================================================================

// Run main
main().catch((err) => {
  logger.error("Fatal error:", err)
  exitApp(1)
})
