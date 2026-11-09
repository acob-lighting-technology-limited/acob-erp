import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return <TablePageSkeleton statCards={0} filters={0} columns={5} rows={6} showStats={false} list="responsive" />
}
