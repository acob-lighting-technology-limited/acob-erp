"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export interface StaffOption {
  value: string
  label: string
}

/**
 * Active staff as select options. Reads staff_directory, not profiles: profiles
 * RLS shows a plain employee only their own row.
 */
export function useStaffOptions(enabled = true): StaffOption[] {
  const [options, setOptions] = useState<StaffOption[]>([])

  useEffect(() => {
    if (!enabled) return
    let active = true
    createClient()
      .from("staff_directory")
      .select("id, full_name, first_name, last_name, department, employment_status")
      .order("last_name", { ascending: true })
      .then(({ data }) => {
        if (!active) return
        setOptions(
          (data || [])
            .filter((p) => !p.employment_status || p.employment_status === "active")
            .map((p) => ({
              value: p.id as string,
              label: `${p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ")}${p.department ? ` · ${p.department}` : ""}`,
            }))
        )
      })
    return () => {
      active = false
    }
  }, [enabled])

  return options
}
