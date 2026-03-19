import { TablePageSkeleton } from "@/components/skeletons"

export default function LeaveLoading() {
  return <TablePageSkeleton filters={2} columns={6} rows={6} showStats={true} statCards={3} />
}
