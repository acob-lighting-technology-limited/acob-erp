// Plain module on purpose (no React): apiFetch imports it, and apiFetch is shared with route handlers.

type Confirmer = () => Promise<boolean>

let confirmer: Confirmer | null = null

/** Set by the edit-access provider while the person is acting as an override; cleared when it unmounts. */
export function setOverrideConfirmer(next: Confirmer | null) {
  confirmer = next
}

/** Calls that cannot be undone: any DELETE, plus the suspend, reset and bulk-exit actions. */
export function isDestructiveCall(method: string, url: string): boolean {
  if (method.toUpperCase() === "DELETE") return true
  return /\/(suspend|reset|bulk-exit)(\/|\?|$)/.test(url)
}

/**
 * Asks an override holder to confirm before a destructive call. Resolves true when nobody needs to be
 * asked (not an override, or not destructive) or when they confirm; false when they back out.
 */
export async function confirmDestructiveIfOverride(method: string, url: string): Promise<boolean> {
  if (!confirmer || !isDestructiveCall(method, url)) return true
  return confirmer()
}
