import { describe, expect, test } from "bun:test"

import { getBundledThemeNames, getTheme } from "./loader"

describe("theme loader", () => {
	test("includes the ghostty bundled theme", () => {
		expect(getBundledThemeNames()).toContain("ghostty")
	})

	test("resolves the ghostty theme with Ghostty default colors", () => {
		const theme = getTheme("ghostty")

		expect(theme.background).toBe("#282c34")
		expect(theme.text).toBe("#ffffff")
		expect(theme.primary).toBe("#7aa6da")
		expect(theme.accent).toBe("#70c0b1")
		expect(theme.error).toBe("#d54e53")
	})
})
