import "server-only"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

export interface RunResult {
  stdout: string
  stderr: string
}

/**
 * Run an external binary with its arguments passed as an array.
 *
 * Use this instead of `exec` with a template literal. `exec` hands the whole
 * string to a shell, so any quote, semicolon, backtick or $( ) inside an
 * interpolated value is executed rather than treated as data — and these
 * routes interpolate request bodies and uploaded filenames. `execFile` passes
 * argv straight to the process, so there is no shell to inject into and
 * arguments need no quoting or escaping.
 *
 * Consequences for callers porting from `exec`:
 *  - Do not wrap arguments in quotes. `"${file}"` becomes `file`.
 *  - Drop `2>&1`. That is shell redirection; stderr comes back separately.
 *  - A non-zero exit still rejects, and the error carries stdout/stderr.
 */
export async function run(
  file: string,
  args: string[],
  options?: { maxBuffer?: number; timeout?: number; cwd?: string }
): Promise<RunResult> {
  const { stdout, stderr } = await execFileAsync(file, args, {
    maxBuffer: options?.maxBuffer ?? 10 * 1024 * 1024,
    timeout: options?.timeout,
    cwd: options?.cwd,
    windowsHide: true,
  })
  return { stdout: stdout.toString(), stderr: stderr.toString() }
}

/**
 * Accept only a plain http(s) URL, for the routes that hand a user-supplied
 * address to a downloader. execFile already removes the injection risk; this
 * additionally stops the binary being pointed at file://, at internal
 * addresses, or at a non-URL entirely.
 */
export function parseHttpUrl(value: unknown): URL | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return null
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null

  const host = parsed.hostname.toLowerCase()
  // Block the obvious SSRF targets. These routes fetch from public media
  // hosts; there is no reason for one to reach the loopback interface or the
  // cloud metadata endpoint.
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    host === "169.254.169.254" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)
  ) {
    return null
  }
  return parsed
}
