"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { logger } from "@/lib/logger"

const log = logger("use-departments")

/**
 * Fetches departments directly from the `departments` table so the UI
 * is never out-of-sync with the database.
 *
 * Returns a sorted list of department *names* (strings) which is the
 * shape every consumer currently expects.
 *
 * Results are cached in a module-level variable with a 5-minute TTL.
 * This is safe in browser context (per-tab module scope) and avoids
 * redundant fetches on the same page. Use `refetch()` to invalidate.
 */

interface DepartmentCache {
  names: string[]
  expiresAt: number
}
let _deptCache: DepartmentCache | null = null

function getCached(): string[] | null {
  if (_deptCache && Date.now() < _deptCache.expiresAt) return _deptCache.names
  _deptCache = null
  return null
}

function setCache(names: string[]) {
  _deptCache = { names, expiresAt: Date.now() + 5 * 60_000 }
}

export function useDepartments() {
  const cached = getCached()
  const [departments, setDepartments] = useState<string[]>(cached ?? [])
  const [isLoading, setIsLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const hit = getCached()
    if (hit) {
      setDepartments(hit)
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function fetchDepartments() {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { data, error: dbError } = await supabase
          .from("departments")
          .select("name")
          .eq("is_active", true)
          .order("name")

        if (dbError) throw dbError
        if (cancelled) return

        const names = (data ?? []).map((d) => d.name)
        setCache(names)
        setDepartments(names)
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to fetch departments"
          log.error({ err: String(err) }, "Failed to fetch departments")
          setError(msg)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchDepartments()
    return () => {
      cancelled = true
    }
  }, [])

  /** Force a fresh fetch (e.g. after creating a new department). */
  const refetch = async () => {
    setIsLoading(true)
    setError(null)
    _deptCache = null

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data, error: dbError } = await supabase
        .from("departments")
        .select("name")
        .eq("is_active", true)
        .order("name")

      if (dbError) throw dbError

      const names = (data ?? []).map((d) => d.name)
      setCache(names)
      setDepartments(names)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch departments"
      log.error({ err: String(err) }, "Failed to fetch departments")
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return { departments, isLoading, error, refetch }
}
