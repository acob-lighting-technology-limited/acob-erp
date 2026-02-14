import { TablePageSkeleton } from "@/components/skeletons"

export default function employeeLoading() {
  return <TablePageSkeleton filters={3} columns={8} rows={10} showStats={false} />
}
