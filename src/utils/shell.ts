/**
 * Quote a string for use in a shell command.
 * Wraps the string in single quotes and escapes any single quotes within it.
 * This preserves all other characters (including newlines) literally.
 */
export function shellQuote(s: string): string {
  // Replace ' with '\'' (close quote, literal quote, open quote)
  return "'" + s.replace(/'/g, "'\\''") + "'"
}
