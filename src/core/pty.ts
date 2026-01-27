/**
 * PTY manager for OpenSWE sessions
 *
 * Spawns OpenCode processes and provides access to PTY streams.
 */

import { spawn } from "bun-pty"
import type { IPty, IDisposable, IExitEvent } from "bun-pty"
import { RingBuffer } from "./buffer"

export interface SpawnOptions {
  sessionId: string
  worktreePath: string
  prompt: string
  resumeSessionId?: string
}

export interface PTYSession {
  id: string
  pid: number
  buffer: RingBuffer
  write: (data: string) => void
  onData: (listener: (data: string) => void) => () => void
  onExit: (listener: (event: IExitEvent) => void) => () => void
}

interface ManagedSession {
  pty: IPty
  buffer: RingBuffer
  disposables: IDisposable[]
}

function buildEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env)
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => [key, value as string])
  )
}

export class PTYManager {
  private sessions: Map<string, ManagedSession>

  constructor() {
    this.sessions = new Map()
  }

  spawnSession(options: SpawnOptions): PTYSession {
    const args = ["--agent", "plan", "--prompt", options.prompt]
    if (options.resumeSessionId) {
      args.push("--session", options.resumeSessionId)
    }

    let pty: IPty
    try {
      pty = spawn("opencode", args, {
        name: "xterm-256color",
        cols: 140,
        rows: 50,
        cwd: options.worktreePath,
        env: buildEnvironment(),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      throw new Error(
        `Failed to spawn opencode: ${message}. Is opencode installed and in PATH?`
      )
    }

    const buffer = new RingBuffer(1000)
    const disposables: IDisposable[] = []

    disposables.push(
      pty.onData((data: string) => {
        buffer.appendChunk(data)
      })
    )

    this.sessions.set(options.sessionId, { pty, buffer, disposables })

    return {
      id: options.sessionId,
      pid: pty.pid,
      buffer,
      write: (data: string) => pty.write(data),
      onData: (listener) => {
        const disposable = pty.onData(listener)
        return () => disposable.dispose()
      },
      onExit: (listener) => {
        const disposable = pty.onExit(listener)
        return () => disposable.dispose()
      },
    }
  }

  getSession(sessionId: string): PTYSession | null {
    const entry = this.sessions.get(sessionId)
    if (!entry) return null

    return {
      id: sessionId,
      pid: entry.pty.pid,
      buffer: entry.buffer,
      write: (data: string) => entry.pty.write(data),
      onData: (listener) => {
        const disposable = entry.pty.onData(listener)
        return () => disposable.dispose()
      },
      onExit: (listener) => {
        const disposable = entry.pty.onExit(listener)
        return () => disposable.dispose()
      },
    }
  }

  killSession(sessionId: string, signal?: string): void {
    const entry = this.sessions.get(sessionId)
    if (!entry) return
    entry.pty.kill(signal)
    entry.disposables.forEach((disposable) => disposable.dispose())
    this.sessions.delete(sessionId)
  }

  listSessions(): string[] {
    return Array.from(this.sessions.keys())
  }
}
