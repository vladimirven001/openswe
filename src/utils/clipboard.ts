/**
 * Cross-platform clipboard utility
 *
 * Supports:
 * - macOS: pbcopy
 * - Windows: clip
 * - Linux: wl-paste (Wayland), xclip, xsel, clip (WSL)
 */

export type ClipboardResult = { success: true } | { success: false; error: string }

async function detectLinuxClipboardTool(): Promise<string | null> {
  const tools = ["wl-paste", "xclip", "xsel"]

  for (const tool of tools) {
    const which = Bun.spawnSync(["which", tool])
    if (which.success) {
      return tool
    }
  }

  return null
}

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
      command = await detectLinuxClipboardTool()
      if (!command) {
        return { success: false, error: "No clipboard tool found (tried wl-paste, xclip, xsel)" }
      }
      break
    }
    default:
      return { success: false, error: `Unsupported platform: ${platform}` }
  }

  if (!command) {
    return { success: false, error: "Could not determine clipboard command" }
  }

  try {
    const proc = Bun.spawn({
      cmd: [command],
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
