import { TablePageSkeleton } from "@/components/skeletons"

export default function OnboardingLoading() {
  return (
    <TablePageSkeleton
      tabs={3}
      filters={3}
      columns={7}
      rows={10}
      showStats={true}
      statCards={3}
      actions={2}
      showBackLink={true}
    />
  )
}
