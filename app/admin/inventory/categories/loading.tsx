import { TablePageSkeleton } from "@/components/skeletons"

export default function CategoriesLoading() {
  return <TablePageSkeleton filters={0} columns={4} rows={6} showStats={false} />
}
