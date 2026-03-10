/**
 * Process Manager Interface
 * 
 * Abstraction for managing background processes (sessions).
 */

export interface ProcessSnapshot {
  lines: string[]
  cursor: { x: number, y: number } | null
}

export type ProcessSpecialKey = "enter" | "backspace" | "tab" | "escape" | "up" | "down" | "left" | "right"

export type ProcessInputChunk =
  | { type: "text"; text: string }
  | { type: "key"; key: ProcessSpecialKey }

export interface ProcessManager {
  /**
   * Spawn a new persistent session
   */
  spawn(id: string, command: string, args: string[], cwd: string, env: Record<string, string>, logPath: string): Promise<number>

  /**
   * Check if a session is running
   */
  isRunning(id: string): Promise<boolean>

  /**
   * Kill a session
   */
  kill(id: string): Promise<void>

  /**
   * Get the current visual state of the session
   */
  getSnapshot(id: string): Promise<ProcessSnapshot>

  /**
   * Send input to the session
   */
  sendInput(id: string, input: ProcessInputChunk[]): Promise<void>

  /**
   * Get list of active session IDs managed by this backend
   */
  listActiveSessions(): Promise<string[]>

  /**
   * Get the command to attach to this session interactively
   */
  getAttachCommand(id: string): string[]

  /**
   * Resize the session terminal
   */
  resize(id: string, cols: number, rows: number): Promise<void>

  /**
   * Set the window title for the session
   */
  setWindowTitle(id: string, title: string): Promise<void>
}
