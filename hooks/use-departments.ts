"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"

/**  
 * Fetches departments directly from the `departments` table so the UI  
 * is never out-of-sync with the database.  
 *  
 * Returns a sorted list of department *names* (strings) which is the  
 * shape every consumer currently expects.  
 *  
 * Results are cached in a module-level variable so repeated mounts in  
 * the same page lifecycle don't re-fetch.  
 */

let cachedDepartments: string[] | null = null

export function useDepartments() {
    const [departments, setDepartments] = useState<string[]>(cachedDepartments ?? [])
    const [isLoading, setIsLoading] = useState(!cachedDepartments)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (cachedDepartments) {
            setDepartments(cachedDepartments)
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
                cachedDepartments = names
                setDepartments(names)
            } catch (err: any) {
                if (!cancelled) {
                    console.error("Failed to fetch departments:", err)
                    setError(err.message ?? "Failed to fetch departments")
                }
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        }

        fetchDepartments()
        return () => { cancelled = true }
    }, [])

    /** Force a fresh fetch (e.g. after creating a new department). */
    const refetch = async () => {
        setIsLoading(true)
        setError(null)
        cachedDepartments = null

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
            cachedDepartments = names
            setDepartments(names)
        } catch (err: any) {
            console.error("Failed to fetch departments:", err)
            setError(err.message ?? "Failed to fetch departments")
        } finally {
            setIsLoading(false)
        }
    }

    return { departments, isLoading, error, refetch }
}
