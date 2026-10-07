import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Below `breakpoint` px wide. Reads the media query through
 * useSyncExternalStore, so it is right on the first client render and false on
 * the server (no effect, no second render).
 */
export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const query = `(max-width: ${breakpoint - 1}px)`
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    [query]
  )
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  )
}
