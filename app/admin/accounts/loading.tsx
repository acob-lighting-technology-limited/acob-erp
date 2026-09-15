import { DashboardSkeleton } from "@/components/skeletons"

export default function FinanceLoading() {
  return <DashboardSkeleton statCards={5} showActivity={true} />
}
