import { describe, expect, test } from "bun:test"
import { BUNDLED_THEMES, resolveTheme } from "./loader"

describe("Theme loader", () => {
  test("resolves the transparent bundled theme", () => {
    const theme = resolveTheme(BUNDLED_THEMES.transparent!, "dark")

    expect(theme.background).toBe("transparent")
    expect(theme.backgroundPanel).toBe("transparent")
    expect(theme.backgroundElement).toBe("transparent")
    expect(theme.selectedListItemBackground).toBe("#1d4ed8")
    expect(theme.selectedListItemText).toBe("#ffffff")
  })

  test("supports transparent literals in existing bundled themes", () => {
    const theme = resolveTheme(BUNDLED_THEMES["lucent-orng"]!, "dark")

    expect(theme.background).toBe("transparent")
    expect(theme.backgroundPanel).toBe("transparent")
    expect(theme.diffAddedBg).toBe("transparent")
  })
})
