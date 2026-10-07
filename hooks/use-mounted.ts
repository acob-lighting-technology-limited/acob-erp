import { useSyncExternalStore } from "react"

const noopSubscribe = () => () => {}

/**
 * False during server render and hydration, true after — the hydration-safe way
 * to gate client-only output (resolved theme, browser-only values). Replaces
 * the `useState(false)` + `useEffect(() => setMounted(true))` pattern, which
 * renders everything twice on load.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
}
