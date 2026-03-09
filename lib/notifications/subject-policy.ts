export type NotificationModule =
  | "Onboarding"
  | "Help Desk"
  | "Leave"
  | "Assets"
  | "Meetings"
  | "Communications"
  | "Reports"

export function withSubjectPrefix(moduleName: NotificationModule, subject: string): string {
  const trimmed = String(subject || "").trim() || "Notification"
  const bracketPrefix = `[${moduleName}]`
  const colonPrefix = `${moduleName}:`

  if (trimmed.startsWith(colonPrefix)) return trimmed
  if (trimmed.startsWith(bracketPrefix)) {
    const rest = trimmed.slice(bracketPrefix.length).trim()
    return `${colonPrefix} ${rest || "Notification"}`
  }
  return `${colonPrefix} ${trimmed}`
}
