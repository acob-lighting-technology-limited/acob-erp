import { TablePageSkeleton } from "@/components/skeletons"

export default function AssetsLoading() {
  return <TablePageSkeleton filters={2} columns={5} rows={6} showStats={false} />
}
