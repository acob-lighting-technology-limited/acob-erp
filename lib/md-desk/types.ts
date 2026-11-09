export type MdDeskQueueKind = "leave" | "requisition" | "correspondence" | "task_rating"

export const MD_DESK_QUEUE_LABELS: Record<MdDeskQueueKind, string> = {
  leave: "Leave",
  requisition: "Requisition",
  correspondence: "Correspondence",
  task_rating: "Task rating",
}

export type MdDeskQueueItem = {
  id: string
  kind: MdDeskQueueKind
  title: string
  detail: string | null
  requester: string
  department: string | null
  waiting_since: string
  /** The existing approval screen where the decision is made. */
  href: string
  urgent: boolean
  amount?: number | null
}

export type MdDeskQueue = {
  items: MdDeskQueueItem[]
  counts: Record<MdDeskQueueKind, number>
}

export type MdDeskAccessDto = {
  isMember: boolean
  canView: boolean
  canEdit: boolean
  isMd: boolean
}
