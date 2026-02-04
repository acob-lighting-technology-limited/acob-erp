import { DashboardSkeleton } from "@/components/skeletons"

export default function DashboardLoading() {
  return <DashboardSkeleton statCards={4} showActivity={true} />
}
