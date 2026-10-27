import { TablePageSkeleton } from "@/components/skeletons"

export default function PmsCbtQuestionLoading() {
  return <TablePageSkeleton statCards={3} filters={2} columns={6} rows={8} showStats={true} showBackLink />
}
