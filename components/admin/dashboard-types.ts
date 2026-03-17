import type { LucideIcon } from "lucide-react"

export type NotificationType = "error" | "warning" | "info"

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: string
  link: string
  linkText: string
}

export interface ModuleAction {
  title: string
  description: string
  href: string
  icon: LucideIcon
  color: string
  roles: string[]
}

export interface RecentActivityItem {
  id: string
  actorName: string
  actionLabel: string
  moduleLabel: string
  moduleKey: string
  createdAt: string
}
