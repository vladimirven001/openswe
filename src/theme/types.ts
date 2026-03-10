/**
 * Theme type definitions for openswe
 *
 * Matches opencode's JSON theme schema for full compatibility
 */

// ============================================================================
// Color Types
// ============================================================================

/** Hex color string */
export type HexColor = `#${string}`

/** Reference to a color defined in defs */
export type RefName = string

/** Dark/light mode variants */
export interface ColorVariant {
  dark: HexColor | RefName
  light: HexColor | RefName
}

/** A color value can be a hex, a reference, or a variant object */
export type ColorValue = HexColor | RefName | ColorVariant

// ============================================================================
// Theme JSON Schema
// ============================================================================

/** Core theme colors (required) */
export interface ThemeColors {
  primary: ColorValue
  secondary: ColorValue
  accent: ColorValue
  error: ColorValue
  warning: ColorValue
  success: ColorValue
  info: ColorValue
  text: ColorValue
  textMuted: ColorValue
  background: ColorValue
  backgroundPanel: ColorValue
  backgroundElement: ColorValue
  border: ColorValue
  borderActive: ColorValue
  borderSubtle: ColorValue
}

/** Extended theme colors for diff views and syntax highlighting */
export interface ThemeColorsExtended extends ThemeColors {
  // Diff colors
  diffAdded?: ColorValue
  diffRemoved?: ColorValue
  diffContext?: ColorValue
  diffHunkHeader?: ColorValue
  diffHighlightAdded?: ColorValue
  diffHighlightRemoved?: ColorValue
  diffAddedBg?: ColorValue
  diffRemovedBg?: ColorValue
  diffContextBg?: ColorValue
  diffLineNumber?: ColorValue
  diffAddedLineNumberBg?: ColorValue
  diffRemovedLineNumberBg?: ColorValue

  // Markdown colors
  markdownText?: ColorValue
  markdownHeading?: ColorValue
  markdownLink?: ColorValue
  markdownLinkText?: ColorValue
  markdownCode?: ColorValue
  markdownBlockQuote?: ColorValue
  markdownEmph?: ColorValue
  markdownStrong?: ColorValue
  markdownHorizontalRule?: ColorValue
  markdownListItem?: ColorValue
  markdownListEnumeration?: ColorValue
  markdownImage?: ColorValue
  markdownImageText?: ColorValue
  markdownCodeBlock?: ColorValue

  // Syntax highlighting colors
  syntaxComment?: ColorValue
  syntaxKeyword?: ColorValue
  syntaxFunction?: ColorValue
  syntaxVariable?: ColorValue
  syntaxString?: ColorValue
  syntaxNumber?: ColorValue
  syntaxType?: ColorValue
  syntaxOperator?: ColorValue
  syntaxPunctuation?: ColorValue
}

/** JSON theme file structure */
export interface ThemeJson {
  $schema?: string
  defs?: Record<string, HexColor | RefName>
  theme: ThemeColorsExtended
}

// ============================================================================
// Resolved Theme
// ============================================================================

/** Core resolved theme colors (all hex strings) */
export interface ResolvedTheme {
  // Core colors
  primary: string
  secondary: string
  accent: string
  error: string
  warning: string
  success: string
  info: string
  text: string
  textMuted: string
  background: string
  backgroundPanel: string
  backgroundElement: string
  border: string
  borderActive: string
  borderSubtle: string

  // Diff colors (with defaults)
  diffAdded: string
  diffRemoved: string
  diffContext: string
  diffHunkHeader: string
  diffHighlightAdded: string
  diffHighlightRemoved: string
  diffAddedBg: string
  diffRemovedBg: string
  diffContextBg: string
  diffLineNumber: string
  diffAddedLineNumberBg: string
  diffRemovedLineNumberBg: string

  // Markdown colors (with defaults)
  markdownText: string
  markdownHeading: string
  markdownLink: string
  markdownLinkText: string
  markdownCode: string
  markdownBlockQuote: string
  markdownEmph: string
  markdownStrong: string
  markdownHorizontalRule: string
  markdownListItem: string
  markdownListEnumeration: string
  markdownImage: string
  markdownImageText: string
  markdownCodeBlock: string

  // Syntax highlighting (with defaults)
  syntaxComment: string
  syntaxKeyword: string
  syntaxFunction: string
  syntaxVariable: string
  syntaxString: string
  syntaxNumber: string
  syntaxType: string
  syntaxOperator: string
  syntaxPunctuation: string
}

/** Theme mode */
export type ThemeMode = "dark" | "light"

/** Theme name from bundled themes */
export type BundledThemeName =
  | "aura"
  | "ayu"
  | "carbonfox"
  | "catppuccin"
  | "catppuccin-frappe"
  | "catppuccin-macchiato"
  | "cobalt2"
  | "cursor"
  | "dracula"
  | "everforest"
  | "flexoki"
  | "github"
  | "gruvbox"
  | "kanagawa"
  | "lucent-orng"
  | "material"
  | "matrix"
  | "mercury"
  | "monokai"
  | "nightowl"
  | "nord"
  | "one-dark"
  | "opencode"
  | "orng"
  | "osaka-jade"
  | "palenight"
  | "rosepine"
  | "solarized"
  | "synthwave84"
  | "tokyonight"
  | "vercel"
  | "vesper"
  | "zenburn"

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a hex color string
 */
export function isHexColor(val: unknown): val is HexColor {
  return typeof val === "string" && val.startsWith("#")
}

/**
 * Check if a value is a color variant object
 */
export function isColorVariant(val: unknown): val is ColorVariant {
  return (
    typeof val === "object" &&
    val !== null &&
    "dark" in val &&
    "light" in val
  )
}
