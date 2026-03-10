/**
 * Cross-platform clipboard utility
 *
 * Supports:
 * - macOS: pbcopy
 * - Windows: clip
 * - Linux: wl-copy (Wayland), xclip, xsel
 */

export type ClipboardResult = { success: true } | { success: false; error: string }

function detectLinuxClipboardTool(): string | null {
  const tools = ["wl-copy", "xclip", "xsel"]

  for (const tool of tools) {
    const which = Bun.spawnSync(["which", tool])
    if (which.success) {
      return tool
    }
  }

  return null
}

/**
 * Copy text to the system clipboard
 *
 * Handles OS detection and uses appropriate tools:
 * - macOS: pbcopy
 * - Windows: clip
 * - Linux: wl-copy (Wayland), xclip, or xsel
 *
 * For xclip/xsel, uses the clipboard selection (not primary).
 *
 * @param text - Text to copy to clipboard
 * @returns Promise resolving to success or error result: { success: true } or { success: false; error: string }
 */
export async function copyToClipboard(text: string): Promise<ClipboardResult> {
  const platform = process.platform

  let command: string | null = null

  switch (platform) {
    case "darwin":
      command = "pbcopy"
      break
    case "win32":
      command = "clip"
      break
    case "linux": {
      command = detectLinuxClipboardTool()
      if (!command) {
        return { success: false, error: "No clipboard tool found (tried wl-copy, xclip, xsel)" }
      }
      break
    }
    default:
      return { success: false, error: `Unsupported platform: ${platform}` }
  }

  try {
    const cmd: string[] = command === "xclip"
      ? ["xclip", "-selection", "clipboard"]
      : command === "xsel"
        ? ["xsel", "--clipboard", "--input"]
        : [command]

    const proc = Bun.spawn({
      cmd,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    })

    proc.stdin.write(text)
    proc.stdin.end()

    const exitCode = await proc.exited

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text()
      return { success: false, error: stderr || `Command ${command} failed with code ${exitCode}` }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
