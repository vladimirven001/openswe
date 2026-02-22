/**
 * Theme module for openswe
 *
 * Provides a complete theming system with 33+ bundled themes
 * and support for custom user themes.
 *
 * @example
 * ```tsx
 * // In app root
 * import { ThemeProvider } from "./index"
 *
 * <ThemeProvider initialTheme="tokyonight">
 *   <App />
 * </ThemeProvider>
 *
 * // In components
 * import { useTheme } from "./index"
 *
 * const { theme, themeName, setTheme } = useTheme()
 * console.log(theme().primary)  // "#7aa2f7"
 * ```
 */

// Types
export type {
  ThemeJson,
  ResolvedTheme,
  ThemeMode,
  BundledThemeName,
  ColorValue,
  ColorVariant,
  HexColor,
  RefName,
} from "./types"
export { isHexColor, isColorVariant } from "./types"

// Loader
export {
  BUNDLED_THEMES,
  DEFAULT_THEME,
  getBundledThemeNames,
  resolveTheme,
  getTheme,
} from "./loader"

// Custom themes
export {
  getCustomThemesDir,
  loadCustomThemes,
  loadCustomTheme,
} from "./custom"

// Context
export {
  ThemeProvider,
  useTheme,
  getDefaultTheme,
} from "./context"
