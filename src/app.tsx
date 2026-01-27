/**
 * Main TUI application entry point
 *
 * Provides startTUI function to launch the OpenSWE terminal interface.
 */

import { render } from "@opentui/solid"
import { createCliRenderer } from "@opentui/core"
import { App } from "./components"
import { ThemeProvider } from "./theme"
import type { GlobalConfig } from "./config"
import { createProject, initDatabaseWithPath, projectExists } from "./store"
import { getStateDatabasePath } from "./workspace/paths"
import { loadProjectConfig } from "./workspace/project"
import { logger } from "./utils/logger"

/**
 * Start the TUI application
 *
 * @param config - Global configuration
 * @param projectRoot - Absolute path to the project root directory
 */
export async function startTUI(config: GlobalConfig, projectRoot: string) {
  // Initialize database with project-specific path
  const dbPath = getStateDatabasePath(projectRoot)
  await initDatabaseWithPath(dbPath)

  // Ensure project metadata exists in the database
  try {
    const projectConfig = await loadProjectConfig(projectRoot)
    if (!projectConfig) {
      logger.warn("Project config not found; skipping project DB initialization")
    } else if (!projectExists()) {
      createProject({
        repoFullName: projectConfig.repoFullName,
        repoUrl: projectConfig.repoUrl,
      })
      logger.debug("Initialized project state in database", projectConfig)
    } else {
      logger.debug("Project state already present in database")
    }
  } catch (error) {
    logger.error("Failed to initialize project state in database", error)
  }

  // Render the TUI
  const rendererConfig = {
    stdin: process.stdin,
    stdout: process.stdout,
    useAlternateScreen: true,
    useMouse: false,
    useKittyKeyboard:
      process.env.OPENTUI_KITTY === "1"
        ? {
            disambiguate: true,
            alternateKeys: true,
            events: true,
          }
        : null,
  }

  process.stdin.resume()

  const renderer = await createCliRenderer(rendererConfig)

  // Wait for destroy event to know when to exit
  const exitPromise = new Promise<void>((resolve) => {
    renderer.on("destroy", () => resolve())
  })

  await render(
    () => (
      <ThemeProvider
        initialTheme={config.ui?.theme}
        initialMode={config.ui?.themeMode}
      >
        <App config={config} projectRoot={projectRoot} />
      </ThemeProvider>
    ),
    renderer,
  )

  await exitPromise
}
