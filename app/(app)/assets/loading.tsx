import { TablePageSkeleton } from "@/components/skeletons/table-page-skeleton"

export default function AssetsLoading() {
  return <TablePageSkeleton showStats={true} statCards={1} filters={0} columns={9} rows={8} />
}
