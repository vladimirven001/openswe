/**
 * Theme context for OpenSWE
 *
 * Provides reactive theme access throughout the TUI
 */

import {
  createContext,
  useContext,
  createSignal,
  onMount,
  createMemo,
  type JSX,
  type Accessor,
} from "solid-js"
import type { ResolvedTheme, ThemeJson, ThemeMode } from "./types"
import { BUNDLED_THEMES, DEFAULT_THEME, resolveTheme } from "./loader"
import { loadCustomThemes } from "./custom"

// ============================================================================
// Theme Context Type
// ============================================================================

interface ThemeContextValue {
  /** Current resolved theme colors */
  theme: Accessor<ResolvedTheme>
  /** Current theme name */
  themeName: Accessor<string>
  /** Current theme mode (dark/light) */
  themeMode: Accessor<ThemeMode>
  /** Set the active theme by name */
  setTheme: (name: string) => void
  /** Set the theme mode */
  setThemeMode: (mode: ThemeMode) => void
  /** List of all available theme names */
  availableThemes: Accessor<string[]>
  /** Check if a theme is a custom (user-defined) theme */
  isCustomTheme: (name: string) => boolean
}

// ============================================================================
// Context Creation
// ============================================================================

const ThemeContext = createContext<ThemeContextValue>()

// ============================================================================
// Theme Provider
// ============================================================================

interface ThemeProviderProps {
  children: JSX.Element
  /** Initial theme name (default: tokyonight) */
  initialTheme?: string
  /** Initial theme mode (default: dark) */
  initialMode?: ThemeMode
}

/**
 * Theme provider component
 *
 * Wraps the application and provides reactive theme access
 */
export function ThemeProvider(props: ThemeProviderProps): JSX.Element {
  const [themeName, setThemeName] = createSignal(
    props.initialTheme ?? DEFAULT_THEME,
  )
  const [themeMode, setThemeMode] = createSignal<ThemeMode>(
    props.initialMode ?? "dark",
  )
  const [customThemes, setCustomThemes] = createSignal<
    Record<string, ThemeJson>
  >({})

  // Load custom themes on mount
  onMount(async () => {
    const themes = await loadCustomThemes()
    setCustomThemes(themes)
  })

  // Combined themes (bundled + custom)
  const allThemes = createMemo(() => ({
    ...BUNDLED_THEMES,
    ...customThemes(),
  }))

  // Available theme names (sorted)
  const availableThemes = createMemo(() =>
    Object.keys(allThemes()).sort(),
  )

  // Check if a theme is custom
  const isCustomTheme = (name: string): boolean => {
    return name in customThemes()
  }

  // Resolved theme (reactive)
  const theme = createMemo(() => {
    const name = themeName()
    const mode = themeMode()
    const themes = allThemes()

    // Try to get the requested theme, fall back to default
    // DEFAULT_THEME is always present in BUNDLED_THEMES
    const themeJson = themes[name] ?? BUNDLED_THEMES[DEFAULT_THEME]!
    return resolveTheme(themeJson, mode)
  })

  // Set theme with validation
  const setTheme = (name: string): void => {
    const themes = allThemes()
    if (name in themes) {
      setThemeName(name)
    } else {
      // Fall back to default if theme doesn't exist
      setThemeName(DEFAULT_THEME)
    }
  }

  const contextValue: ThemeContextValue = {
    theme,
    themeName,
    themeMode,
    setTheme,
    setThemeMode,
    availableThemes,
    isCustomTheme,
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {props.children}
    </ThemeContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Use the theme context
 *
 * Must be used within a ThemeProvider
 *
 * @returns Theme context value
 * @throws Error if used outside ThemeProvider
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}

// ============================================================================
// Static Theme Access
// ============================================================================

/**
 * Get the default theme (for use outside of reactive context)
 *
 * This is useful for components that need theme colors but can't use
 * the reactive context (e.g., during initialization)
 */
export function getDefaultTheme(): ResolvedTheme {
  // DEFAULT_THEME is always present in BUNDLED_THEMES
  return resolveTheme(BUNDLED_THEMES[DEFAULT_THEME]!, "dark")
}
