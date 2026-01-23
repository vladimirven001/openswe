/**
 * Main TUI application entry point
 *
 * Provides startTUI function to launch the OpenSWE terminal interface.
 */

import { render } from "@opentui/solid"
import { App } from "./components"
import type { GlobalConfig } from "./config"
import { initDatabaseWithPath } from "./store"
import { getStateDatabasePath } from "./workspace/paths"

/**
 * Start the TUI application
 *
 * @param config - Global configuration
 * @param projectRoot - Absolute path to the project root directory
 */
export async function startTUI(config: GlobalConfig, projectRoot: string) {
  // Initialize database with project-specific path
  const dbPath = getStateDatabasePath(projectRoot)
  initDatabaseWithPath(dbPath)

  // Render the TUI
  await render(() => <App config={config} projectRoot={projectRoot} />)
}
