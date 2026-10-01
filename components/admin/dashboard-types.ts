export type ActionQueueTone = "critical" | "attention" | "info"
export type ActionQueueGroup = "approvals" | "attention"

export interface ActionQueueItem {
  id: string
  group: ActionQueueGroup
  tone: ActionQueueTone
  title: string
  description: string
  count: number
  href: string
}

export interface RecentActivityItem {
  id: string
  actorName: string
  actionLabel: string
  moduleLabel: string
  moduleKey: string
  createdAt: string
}
