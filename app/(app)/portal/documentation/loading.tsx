import { TablePageSkeleton } from "@/components/skeletons"

export default function DocumentationLoading() {
  return <TablePageSkeleton filters={2} columns={3} rows={6} showStats={false} />
}
