import { TablePageSkeleton } from "@/components/skeletons"

export default function LeaveTestLoading() {
  return <TablePageSkeleton filters={2} columns={5} rows={5} showStats={false} />
}
