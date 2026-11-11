import type { DataTableTab } from "@/components/ui/data-table"

export const ATTENDANCE_TABS: DataTableTab[] = [
  { key: "log", label: "Log" },
  { key: "calendar", label: "Calendar" },
]

/** The tab keys, for `useUrlTab`, so a link can open one with `?tab=`. */
export const ATTENDANCE_TAB_KEYS = ["log", "calendar"] as const
