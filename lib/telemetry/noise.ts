/**
 * Browser reports that no change to this codebase can fix, so they only bury
 * the errors that need attention. Kept narrow on purpose: an unknown message
 * is always reported. Chunk-load and hydration errors are NOT here — they are
 * real signals (a deploy disrupting sessions, a server/client render mismatch).
 */
const NOISE_MESSAGES = [
  // Harmless browser warning raised when a resize callback triggers another resize.
  /^ResizeObserver loop (completed with undelivered notifications|limit exceeded)/i,
  // A cross-origin script failed; the browser hides every detail, so it is not actionable.
  /^Script error\.?$/i,
  // Extension messaging APIs (chrome.runtime.sendMessage and friends) called by
  // injected extension code, not ours — the app never uses them.
  /reading '(sendMessage|postMessage|onMessage|runtime)'/i,
]

// Stacks from code injected into the page by a browser extension.
const EXTENSION_STACK = /(chrome|moz|safari(-web)?)-extension:\/\//i

export function isClientNoise(message: string, stack?: string | null): boolean {
  if (NOISE_MESSAGES.some((pattern) => pattern.test(message.trim()))) return true
  return !!stack && EXTENSION_STACK.test(stack)
}
