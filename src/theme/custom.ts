/**
 * Custom theme loader for OpenSWE
 *
 * Loads user-defined themes from ~/.config/openswe/themes/
 */

import { homedir } from "os"
import path from "path"
import { Glob } from "bun"
import type { ThemeJson } from "./types"
import { logger } from "@/utils/logger"

// ============================================================================
// Custom Theme Directory
// ============================================================================

/** Get the custom themes directory path */
export function getCustomThemesDir(): string {
  return path.join(homedir(), ".config", "openswe", "themes")
}

// ============================================================================
// Custom Theme Loader
// ============================================================================

/**
 * Load all custom themes from the user's config directory
 *
 * Themes are loaded from ~/.config/openswe/themes/*.json
 * Invalid themes are skipped with a warning
 *
 * @returns Record of theme name to theme JSON
 */
export async function loadCustomThemes(): Promise<Record<string, ThemeJson>> {
  const themesDir = getCustomThemesDir()
  const result: Record<string, ThemeJson> = {}

  try {
    // Check if themes directory exists
    const dirFile = Bun.file(themesDir)
    const dirExists = await dirFile.exists()

    if (!dirExists) {
      // Directory doesn't exist - that's fine, no custom themes
      return result
    }

    // Scan for JSON files
    const glob = new Glob("*.json")

    for await (const file of glob.scan({ cwd: themesDir, absolute: false })) {
      const name = path.basename(file, ".json")
      const filePath = path.join(themesDir, file)

      try {
        const content = await Bun.file(filePath).json()

        // Basic validation - must have a theme object
        if (!content.theme || typeof content.theme !== "object") {
          logger.warn(`Invalid custom theme ${name}: missing 'theme' object`)
          continue
        }

        // Validate required colors exist
        const requiredColors = [
          "primary",
          "secondary",
          "accent",
          "error",
          "warning",
          "success",
          "info",
          "text",
          "textMuted",
          "background",
          "backgroundPanel",
          "backgroundElement",
          "border",
          "borderActive",
          "borderSubtle",
        ]

        const missingColors = requiredColors.filter(
          (c) => !(c in content.theme),
        )
        if (missingColors.length > 0) {
          logger.warn(
            `Invalid custom theme ${name}: missing colors: ${missingColors.join(", ")}`,
          )
          continue
        }

        result[name] = content as ThemeJson
        logger.debug(`Loaded custom theme: ${name}`)
      } catch (error) {
        logger.warn(`Failed to load custom theme ${name}:`, error)
      }
    }
  } catch (error) {
    // If we can't read the directory at all, just return empty
    logger.debug("Could not read custom themes directory:", error)
  }

  return result
}

/**
 * Load a single custom theme by name
 *
 * @param name - Theme name (without .json extension)
 * @returns Theme JSON if found, undefined otherwise
 */
export async function loadCustomTheme(
  name: string,
): Promise<ThemeJson | undefined> {
  const themesDir = getCustomThemesDir()
  const filePath = path.join(themesDir, `${name}.json`)

  try {
    const file = Bun.file(filePath)
    if (!(await file.exists())) {
      return undefined
    }

    const content = await file.json()
    if (!content.theme || typeof content.theme !== "object") {
      return undefined
    }

    return content as ThemeJson
  } catch {
    return undefined
  }
}
