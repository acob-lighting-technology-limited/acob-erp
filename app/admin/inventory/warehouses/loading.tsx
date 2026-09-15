import { TablePageSkeleton } from "@/components/skeletons"

export default function WarehousesLoading() {
  return <TablePageSkeleton filters={1} columns={5} rows={6} showStats={true} statCards={4} actions={2} />
}
