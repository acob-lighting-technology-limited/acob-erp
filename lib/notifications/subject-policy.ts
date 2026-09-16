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

export function withSubjectPrefix(moduleName: NotificationModule, subject: string): string {
  return String(subject || "").trim() || "Notification"
}
