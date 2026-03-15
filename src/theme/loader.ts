/**
 * Theme loader for openswe
 *
 * Loads bundled themes and resolves color references
 */

import type {
  ThemeJson,
  ResolvedTheme,
  ColorValue,
  ThemeMode,
  HexColor,
  RefName,
} from "./types"
import { isHexColor, isColorVariant } from "./types"

// ============================================================================
// Bundled Theme Imports
// ============================================================================

import aura from "./themes/aura.json"
import ayu from "./themes/ayu.json"
import carbonfox from "./themes/carbonfox.json"
import catppuccin from "./themes/catppuccin.json"
import catppuccinFrappe from "./themes/catppuccin-frappe.json"
import catppuccinMacchiato from "./themes/catppuccin-macchiato.json"
import cobalt2 from "./themes/cobalt2.json"
import cursor from "./themes/cursor.json"
import dracula from "./themes/dracula.json"
import everforest from "./themes/everforest.json"
import flexoki from "./themes/flexoki.json"
import ghostty from "./themes/ghostty.json"
import github from "./themes/github.json"
import gruvbox from "./themes/gruvbox.json"
import kanagawa from "./themes/kanagawa.json"
import lucentOrng from "./themes/lucent-orng.json"
import material from "./themes/material.json"
import matrix from "./themes/matrix.json"
import mercury from "./themes/mercury.json"
import monokai from "./themes/monokai.json"
import nightowl from "./themes/nightowl.json"
import nord from "./themes/nord.json"
import oneDark from "./themes/one-dark.json"
import opencode from "./themes/opencode.json"
import orng from "./themes/orng.json"
import osakaJade from "./themes/osaka-jade.json"
import palenight from "./themes/palenight.json"
import rosepine from "./themes/rosepine.json"
import solarized from "./themes/solarized.json"
import synthwave84 from "./themes/synthwave84.json"
import tokyonight from "./themes/tokyonight.json"
import vercel from "./themes/vercel.json"
import vesper from "./themes/vesper.json"
import zenburn from "./themes/zenburn.json"

// ============================================================================
// Bundled Themes Registry
// ============================================================================

/** All bundled themes, keyed by name */
export const BUNDLED_THEMES: Record<string, ThemeJson> = {
  aura: aura as ThemeJson,
  ayu: ayu as ThemeJson,
  carbonfox: carbonfox as ThemeJson,
  catppuccin: catppuccin as ThemeJson,
  "catppuccin-frappe": catppuccinFrappe as ThemeJson,
  "catppuccin-macchiato": catppuccinMacchiato as ThemeJson,
  cobalt2: cobalt2 as ThemeJson,
  cursor: cursor as ThemeJson,
  dracula: dracula as ThemeJson,
  everforest: everforest as ThemeJson,
  flexoki: flexoki as ThemeJson,
  ghostty: ghostty as ThemeJson,
  github: github as ThemeJson,
  gruvbox: gruvbox as ThemeJson,
  kanagawa: kanagawa as ThemeJson,
  "lucent-orng": lucentOrng as ThemeJson,
  material: material as ThemeJson,
  matrix: matrix as ThemeJson,
  mercury: mercury as ThemeJson,
  monokai: monokai as ThemeJson,
  nightowl: nightowl as ThemeJson,
  nord: nord as ThemeJson,
  "one-dark": oneDark as ThemeJson,
  opencode: opencode as ThemeJson,
  orng: orng as ThemeJson,
  "osaka-jade": osakaJade as ThemeJson,
  palenight: palenight as ThemeJson,
  rosepine: rosepine as ThemeJson,
  solarized: solarized as ThemeJson,
  synthwave84: synthwave84 as ThemeJson,
  tokyonight: tokyonight as ThemeJson,
  vercel: vercel as ThemeJson,
  vesper: vesper as ThemeJson,
  zenburn: zenburn as ThemeJson,
}

/** Default theme name */
export const DEFAULT_THEME = "tokyonight"

/** Get list of all bundled theme names */
export function getBundledThemeNames(): string[] {
  return Object.keys(BUNDLED_THEMES).sort()
}

// ============================================================================
// Theme Resolution
// ============================================================================

/**
 * Resolve a color value to a hex string
 *
 * @param color - The color value to resolve
 * @param defs - Color definitions from the theme
 * @param mode - Dark or light mode
 * @param visited - Track visited refs to detect cycles
 * @returns Resolved hex color string
 */
function resolveColor(
  color: ColorValue,
  defs: Record<string, HexColor | RefName>,
  mode: ThemeMode,
  visited: Set<string> = new Set(),
): string {
  // If it's a variant object, extract the appropriate mode value
  if (isColorVariant(color)) {
    return resolveColor(color[mode], defs, mode, visited)
  }

  // If it's a hex color, return it directly
  if (isHexColor(color)) {
    return color
  }

  // It's a reference name - look it up in defs
  const refName = color as RefName

  // Check for circular reference
  if (visited.has(refName)) {
    throw new Error(`Circular color reference detected: ${refName}`)
  }

  const resolved = defs[refName]
  if (resolved === undefined) {
    throw new Error(`Unknown color reference: ${refName}`)
  }

  // Add to visited set and recurse
  visited.add(refName)
  return resolveColor(resolved, defs, mode, visited)
}

/**
 * Resolve a theme JSON to a fully resolved theme object
 *
 * @param theme - The theme JSON to resolve
 * @param mode - Dark or light mode (default: dark)
 * @returns Resolved theme with all hex colors
 */
export function resolveTheme(
  theme: ThemeJson,
  mode: ThemeMode = "dark",
): ResolvedTheme {
  const defs = theme.defs ?? {}
  const t = theme.theme

  // Helper to resolve with fallback
  const resolve = (color: ColorValue | undefined, fallback: string): string => {
    if (color === undefined) return fallback
    try {
      return resolveColor(color, defs, mode)
    } catch {
      return fallback
    }
  }

  // Resolve core colors (required)
  const primary = resolveColor(t.primary, defs, mode)
  const secondary = resolveColor(t.secondary, defs, mode)
  const accent = resolveColor(t.accent, defs, mode)
  const error = resolveColor(t.error, defs, mode)
  const warning = resolveColor(t.warning, defs, mode)
  const success = resolveColor(t.success, defs, mode)
  const info = resolveColor(t.info, defs, mode)
  const text = resolveColor(t.text, defs, mode)
  const textMuted = resolveColor(t.textMuted, defs, mode)
  const background = resolveColor(t.background, defs, mode)
  const backgroundPanel = resolveColor(t.backgroundPanel, defs, mode)
  const backgroundElement = resolveColor(t.backgroundElement, defs, mode)
  const border = resolveColor(t.border, defs, mode)
  const borderActive = resolveColor(t.borderActive, defs, mode)
  const borderSubtle = resolveColor(t.borderSubtle, defs, mode)

  return {
    // Core colors
    primary,
    secondary,
    accent,
    error,
    warning,
    success,
    info,
    text,
    textMuted,
    background,
    backgroundPanel,
    backgroundElement,
    border,
    borderActive,
    borderSubtle,

    // Diff colors (with sensible defaults)
    diffAdded: resolve(t.diffAdded, success),
    diffRemoved: resolve(t.diffRemoved, error),
    diffContext: resolve(t.diffContext, textMuted),
    diffHunkHeader: resolve(t.diffHunkHeader, secondary),
    diffHighlightAdded: resolve(t.diffHighlightAdded, success),
    diffHighlightRemoved: resolve(t.diffHighlightRemoved, error),
    diffAddedBg: resolve(t.diffAddedBg, backgroundPanel),
    diffRemovedBg: resolve(t.diffRemovedBg, backgroundPanel),
    diffContextBg: resolve(t.diffContextBg, backgroundPanel),
    diffLineNumber: resolve(t.diffLineNumber, borderSubtle),
    diffAddedLineNumberBg: resolve(t.diffAddedLineNumberBg, backgroundPanel),
    diffRemovedLineNumberBg: resolve(t.diffRemovedLineNumberBg, backgroundPanel),

    // Markdown colors (with sensible defaults)
    markdownText: resolve(t.markdownText, text),
    markdownHeading: resolve(t.markdownHeading, secondary),
    markdownLink: resolve(t.markdownLink, primary),
    markdownLinkText: resolve(t.markdownLinkText, info),
    markdownCode: resolve(t.markdownCode, success),
    markdownBlockQuote: resolve(t.markdownBlockQuote, warning),
    markdownEmph: resolve(t.markdownEmph, warning),
    markdownStrong: resolve(t.markdownStrong, accent),
    markdownHorizontalRule: resolve(t.markdownHorizontalRule, textMuted),
    markdownListItem: resolve(t.markdownListItem, primary),
    markdownListEnumeration: resolve(t.markdownListEnumeration, info),
    markdownImage: resolve(t.markdownImage, primary),
    markdownImageText: resolve(t.markdownImageText, info),
    markdownCodeBlock: resolve(t.markdownCodeBlock, text),

    // Syntax highlighting (with sensible defaults)
    syntaxComment: resolve(t.syntaxComment, textMuted),
    syntaxKeyword: resolve(t.syntaxKeyword, secondary),
    syntaxFunction: resolve(t.syntaxFunction, primary),
    syntaxVariable: resolve(t.syntaxVariable, error),
    syntaxString: resolve(t.syntaxString, success),
    syntaxNumber: resolve(t.syntaxNumber, accent),
    syntaxType: resolve(t.syntaxType, warning),
    syntaxOperator: resolve(t.syntaxOperator, info),
    syntaxPunctuation: resolve(t.syntaxPunctuation, text),
  }
}

/**
 * Get a resolved theme by name
 *
 * @param name - Theme name (must be a bundled theme name)
 * @param mode - Dark or light mode (default: dark)
 * @returns Resolved theme, or default theme if not found
 */
export function getTheme(name: string, mode: ThemeMode = "dark"): ResolvedTheme {
  // DEFAULT_THEME is always present in BUNDLED_THEMES
  const theme = BUNDLED_THEMES[name] ?? BUNDLED_THEMES[DEFAULT_THEME]!
  return resolveTheme(theme, mode)
}
