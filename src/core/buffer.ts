/**
 * Ring buffer for PTY output
 *
 * Stores a fixed number of recent lines in memory.
 */

type LineListener = (line: string) => void

export class RingBuffer {
  private lines: string[]
  private maxLines: number
  private partial: string
  private listeners: LineListener[]

  constructor(maxLines: number = 1000) {
    this.lines = []
    this.maxLines = maxLines
    this.partial = ""
    this.listeners = []
  }

  append(line: string): void {
    this.lines.push(line)
    if (this.lines.length > this.maxLines) {
      this.lines.splice(0, this.lines.length - this.maxLines)
    }
    this.listeners.forEach((listener) => listener(line))
  }

  appendChunk(data: string): void {
    const sanitized = data.replace(/\r/g, "")
    const parts = sanitized.split("\n")

    if (parts.length === 1) {
      this.partial += parts[0]
      return
    }

    const first = parts.shift() ?? ""
    this.append(this.partial + first)
    this.partial = ""

    const last = parts.pop()
    if (typeof last === "string") {
      this.partial = last
    }

    parts.forEach((line) => this.append(line))
  }

  getLines(count?: number): string[] {
    if (!count || count >= this.lines.length) {
      return [...this.lines]
    }
    return this.lines.slice(-count)
  }

  clear(): void {
    this.lines = []
    this.partial = ""
  }

  onLine(listener: LineListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener)
    }
  }
}
