import { TablePageSkeleton } from "@/components/skeletons"

export default function AdminSecurityNetworkActivityLoading() {
  return <TablePageSkeleton filters={2} columns={3} rows={8} statBadges={3} />
}
