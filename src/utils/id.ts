import { v4 as uuidv4 } from "uuid"

/**
 * Generate a unique identifier (UUID v4)
 */
export function generateId(): string {
  return uuidv4()
}

/**
 * Generate a short ID (first 8 characters of UUID)
 */
export function generateShortId(): string {
  return uuidv4().slice(0, 8)
}
