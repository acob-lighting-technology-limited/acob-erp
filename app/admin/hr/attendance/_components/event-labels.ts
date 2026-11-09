/** How the attendance change log names and colours each kind of event. */
export const EVENT_LABELS: Record<string, string> = {
  device_punch_in: "Clocked in (device)",
  device_punch_out: "Clocked out (device)",
  self_clock_in: "Clocked in",
  self_clock_out: "Clocked out",
  remote_clock_in: "Remote clock-in",
  remote_clock_out: "Remote clock-out",
  manual_create: "Manual record created",
  manual_update: "Manual edit",
  manual_delete: "Record deleted",
  bulk_grant: "Bulk grant",
  bulk_delete: "Bulk removal",
  appeal_requested: "Appeal requested",
  appeal_rejected: "Appeal rejected",
  appeal_approved: "Appeal approved",
  appeal_auto_resolved: "Appeal auto-approved",
  leave_granted: "Leave granted",
  leave_revoked: "Leave revoked",
  exemption_added: "Exemption added",
  exemption_removed: "Exemption removed",
  marked_incomplete: "Auto-marked incomplete",
}

export function eventBadgeClass(eventType: string): string {
  if (eventType.startsWith("appeal_")) {
    if (eventType === "appeal_rejected") return "bg-danger/15 text-danger"
    if (eventType.includes("approved") || eventType.includes("resolved")) return "bg-success/15 text-success"
    return "bg-warning/15 text-warning"
  }
  if (eventType.startsWith("device_")) return "bg-info/15 text-info"
  if (eventType.startsWith("manual_") || eventType.startsWith("bulk_")) return "bg-purple/15 text-purple"
  if (eventType === "marked_incomplete") return "bg-info/15 text-info"
  return "bg-muted text-muted-foreground"
}
