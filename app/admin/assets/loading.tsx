import { TablePageSkeleton } from "@/components/skeletons"

export default function AssetsLoading() {
  return <TablePageSkeleton filters={3} columns={6} rows={8} showStats={true} statCards={4} />
}
