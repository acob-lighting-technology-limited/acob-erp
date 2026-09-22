import "server-only"
import { readdir, stat } from "fs/promises"
import path from "path"

/**
 * Find the most recently modified file in a directory.
 *
 * Replaces the shell one-liners these download routes used to locate whatever
 * yt-dlp just wrote — `ls -t "$dir"/*123* | head -1`, `find "$dir" -name
 * "*.mp3" -mmin -2 | head -1`, and so on. Those needed a shell, which is what
 * made the surrounding command strings injectable, and they were silently
 * platform-specific: `ls -t`, `find -mmin` and brace expansion are not
 * available on Windows, so every fallback threw there and the route limped
 * along on whichever one happened not to.
 *
 * Returns an absolute path, or null when nothing matches.
 */
export async function findNewestFile(
  dir: string,
  options: {
    /** Only consider names containing this substring. */
    contains?: string
    /** Only consider these extensions, e.g. [".mp3"]. Leading dot, lowercase. */
    extensions?: string[]
    /** Only consider files modified within this many milliseconds. */
    withinMs?: number
  } = {}
): Promise<string | null> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return null
  }

  const cutoff = options.withinMs ? Date.now() - options.withinMs : null
  let best: { file: string; mtimeMs: number } | null = null

  for (const name of entries) {
    if (options.contains && !name.includes(options.contains)) continue
    if (options.extensions && !options.extensions.includes(path.extname(name).toLowerCase())) continue

    const full = path.join(dir, name)
    try {
      const info = await stat(full)
      if (!info.isFile()) continue
      if (cutoff !== null && info.mtimeMs < cutoff) continue
      if (!best || info.mtimeMs > best.mtimeMs) best = { file: full, mtimeMs: info.mtimeMs }
    } catch {
      // Raced with cleanup, or not readable. Skip it.
    }
  }

  return best?.file ?? null
}

/**
 * yt-dlp format selectors, as sent by the client.
 *
 * These are interpolated into the downloader's arguments, so they are matched
 * against a conservative shape rather than trusted: ids, `best`, and the
 * `bestvideo+bestaudio` style combinations yt-dlp accepts. Anything else is
 * rejected and the caller falls back to "best".
 */
export function isSafeFormatSelector(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64 && /^[A-Za-z0-9_+./-]+$/.test(value)
}
