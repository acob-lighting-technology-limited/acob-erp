import { TablePageSkeleton } from "@/components/skeletons"

export default function NotificationsLoading() {
  return <TablePageSkeleton filters={1} columns={3} rows={8} showStats={false} />
}
