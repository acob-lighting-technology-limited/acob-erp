import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return <TablePageSkeleton filters={0} columns={4} rows={5} showStats={true} statCards={4} actions={2} />
}
