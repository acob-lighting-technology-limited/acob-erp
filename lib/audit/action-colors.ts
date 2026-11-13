/**
 * Canonical Tailwind class strings for each audit action.
 * Used in the audit-log table, Excel export, PDF export, and Word export.
 * Single source of truth — update here, not in the consumer files.
 */
import { TONE_CLASSES } from "@/lib/ui/status-tones"

export const AUDIT_ACTION_COLORS: Record<string, string> = {
  create: TONE_CLASSES.success,
  update: TONE_CLASSES.info,
  delete: TONE_CLASSES.danger,
  assign: TONE_CLASSES.purple,
  unassign: TONE_CLASSES.warning,
  approve: TONE_CLASSES.purple,
  reject: TONE_CLASSES.warning,
  dispatch: TONE_CLASSES.info,
  send: TONE_CLASSES.info,
  status_change: TONE_CLASSES.warning,
  default: TONE_CLASSES.neutral,
}

/**
 * Returns the Tailwind color classes for a given audit action string.
 * Falls back to the `default` entry for unknown actions.
 */
export function getAuditActionColor(action: string): string {
  return AUDIT_ACTION_COLORS[action] ?? AUDIT_ACTION_COLORS.default
}
