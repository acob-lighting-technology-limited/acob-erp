/**
 * Nonce-based Content-Security-Policy (audit 11.11).
 *
 * next.config.mjs still sends the baseline policy (with script-src
 * 'unsafe-inline') on every response. When CSP_NONCE=on, the proxy adds this
 * stricter policy as a second header. Browsers enforce every CSP header they
 * receive, so the stricter one wins: inline scripts must carry the request's
 * nonce, which Next.js adds to its own scripts when it sees the policy on the
 * request.
 *
 * Off by default because one inline script without the nonce blanks the page.
 * Turn it on locally (CSP_NONCE=on), check the console for CSP violations on
 * every shell, then enable it in Vercel.
 *
 * 'unsafe-eval' stays: xlsx, jspdf and docx use eval() internally.
 */
const SUPABASE_HOST = "https://itqegqxeqkeogwrvlzlj.supabase.co"

export function isNonceCspEnabled(): boolean {
  return process.env.CSP_NONCE === "on"
}

export function createNonce(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

export function buildNonceCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production"
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets nonce'd scripts load their own chunks; host lists are
    // ignored by CSP3 browsers but kept as a fallback for older ones.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' https://va.vercel-scripts.com${isDev ? " 'unsafe-inline'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${SUPABASE_HOST}`,
    "font-src 'self'",
    `connect-src 'self' ${SUPABASE_HOST} wss://itqegqxeqkeogwrvlzlj.supabase.co https://vitals.vercel-insights.com${isDev ? " ws:" : ""}`,
    "frame-ancestors 'self'",
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ")
}
