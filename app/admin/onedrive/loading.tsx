import { TablePageSkeleton } from "@/components/skeletons/table-page-skeleton"

export default function Loading() {
  return <TablePageSkeleton showStats={true} statCards={5} />
}
