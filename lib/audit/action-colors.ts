/**
 * Canonical Tailwind class strings for each audit action.
 * Used in the audit-log table, Excel export, PDF export, and Word export.
 * Single source of truth — update here, not in the consumer files.
 */
export const AUDIT_ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  delete: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  assign: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  unassign: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  approve: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  reject: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
  dispatch: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  send: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  status_change: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  default: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
}

/**
 * Returns the Tailwind color classes for a given audit action string.
 * Falls back to the `default` entry for unknown actions.
 */
export function getAuditActionColor(action: string): string {
  return AUDIT_ACTION_COLORS[action] ?? AUDIT_ACTION_COLORS.default
}
