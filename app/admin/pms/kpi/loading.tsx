import { TablePageSkeleton } from "@/components/skeletons"

export default function PmsKpiLoading() {
  return <TablePageSkeleton tabs={3} filters={2} columns={6} rows={8} showStats={false} />
}
