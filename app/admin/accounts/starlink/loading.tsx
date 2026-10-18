import { TablePageSkeleton } from "@/components/skeletons"

export default function StarlinkKitsLoading() {
  return <TablePageSkeleton filters={3} columns={7} rows={8} showStats={true} statCards={4} />
}
