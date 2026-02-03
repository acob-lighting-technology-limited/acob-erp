import { TablePageSkeleton } from "@/components/skeletons"

export default function DocumentationLoading() {
  return <TablePageSkeleton filters={2} columns={4} rows={8} showStats={false} />
}
