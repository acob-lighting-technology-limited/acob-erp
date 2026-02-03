import { TablePageSkeleton } from "@/components/skeletons"

export default function LeaveApproveLoading() {
  return <TablePageSkeleton filters={2} columns={6} rows={6} showStats={false} />
}
