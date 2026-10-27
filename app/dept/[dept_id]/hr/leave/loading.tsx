import { TablePageSkeleton } from "@/components/skeletons"

export default function LeaveApproveLoading() {
  return (
    <TablePageSkeleton statCards={3} filters={4} columns={6} rows={6} showStats={true} tabs={4} list="responsive" />
  )
}
