import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton filters={2} columns={7} rows={8} showStats={false} actions={1} showBackLink list="responsive" />
  )
}
