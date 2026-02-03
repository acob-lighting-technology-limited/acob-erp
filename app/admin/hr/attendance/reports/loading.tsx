import { TablePageSkeleton } from "@/components/skeletons"

export default function AttendanceReportsLoading() {
  return <TablePageSkeleton filters={3} columns={5} rows={8} showStats={false} />
}
