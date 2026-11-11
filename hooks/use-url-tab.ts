"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

/**
 * Tab state that honours `?tab=`, so an email or notification can open the tab where
 * the reader has to act instead of always landing on the first one.
 *
 * Every page that has tabs and is linked from a notification or email must use this
 * (or read `tab` itself); `lib/notifications/__tests__/link-tabs.test.ts` fails the
 * build when one does not. An unknown or missing value falls back to `fallback`, and
 * the setter ignores keys that are not in `allowed`, so it can be passed straight to a
 * tab bar's `onTabChange`.
 */
export function useUrlTab<T extends string>(allowed: readonly T[], fallback: T) {
  const requested = useSearchParams().get("tab")
  const allowedKey = allowed.join("|")
  const isAllowed = useCallback(
    (value: string | null): value is T => value !== null && allowedKey.split("|").includes(value),
    [allowedKey]
  )

  const [tab, setTab] = useState<T>(isAllowed(requested) ? requested : fallback)

  // A second link to the same page (clicked while it is already open) changes the URL
  // without remounting, so follow it.
  useEffect(() => {
    if (isAllowed(requested)) setTab(requested)
  }, [requested, isAllowed])

  const select = useCallback(
    (next: string) => {
      if (isAllowed(next)) setTab(next)
    },
    [isAllowed]
  )

  return [tab, select] as const
}
