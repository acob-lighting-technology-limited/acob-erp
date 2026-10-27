"use client"

import { useMemo } from "react"
import { usePathname } from "next/navigation"
import { shellBackHref, shellBaseFromPathname, shellHref } from "@/lib/dept/shell-links"

/**
 * The shell the page is in, and link helpers bound to it. Views shared by /admin and /dept/<id> use this
 * instead of writing `/admin/…` literals, so a department lead's links stay inside their console.
 *
 *   const shell = useShellBase()
 *   const issues = shell.href("/admin/assets/issues")        // string, or null if the console has no such page
 *   backLink={{ href: shell.backHref("/admin/hr"), label: "Back to HR" }}
 *
 * The object is stable while the shell is, so it is safe in dependency arrays.
 */
export function useShellBase() {
  const base = shellBaseFromPathname(usePathname())
  return useMemo(
    () => ({
      base,
      href: (adminHref: string) => shellHref(adminHref, base),
      backHref: (adminHref: string) => shellBackHref(adminHref, base),
    }),
    [base]
  )
}
