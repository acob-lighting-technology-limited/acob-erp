import { TablePageSkeleton } from "@/components/skeletons"

export default function StaffLoading() {
  return <TablePageSkeleton filters={3} columns={8} rows={10} showStats={false} />
}
