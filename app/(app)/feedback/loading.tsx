import { TablePageSkeleton } from "@/components/skeletons/table-page-skeleton"

export default function FeedbackLoading() {
  return <TablePageSkeleton showStats={false} filters={1} columns={6} rows={8} />
}
