import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return <TablePageSkeleton filters={1} columns={6} rows={8} showStats={true} statCards={3} />
}
