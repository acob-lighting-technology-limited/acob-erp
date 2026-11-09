import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return <TablePageSkeleton statCards={4} filters={2} columns={5} rows={6} showStats={false} actions={1} />
}
