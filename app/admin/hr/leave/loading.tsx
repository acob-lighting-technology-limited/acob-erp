import { TablePageSkeleton } from "@/components/skeletons"

export default function LeaveLoading() {
  return (
    <TablePageSkeleton statCards={3} filters={4} columns={6} rows={8} showStats={true} tabs={4} list="responsive" />
  )
}
