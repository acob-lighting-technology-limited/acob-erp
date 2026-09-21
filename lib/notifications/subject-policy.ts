export type NotificationModule =
  | "Onboarding"
  | "Help Desk"
  | "Leave"
  | "Assets"
  | "Meetings"
  | "Communications"
  | "Reports"
  | "Tasks"
  | "Attendance"
  | "Exit"
  | "Birthday"
  | "Payments"
  | "Payroll"
  | "Correspondence"
  | "Security"
  | "System Health"

export function withSubjectPrefix(moduleName: NotificationModule, subject: string): string {
  return String(subject || "").trim() || "Notification"
}
