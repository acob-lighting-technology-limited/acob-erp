import { TablePageSkeleton } from "@/components/skeletons"

export default function OnboardingLoading() {
  return (
    <TablePageSkeleton
      statCards={3}
      filters={3}
      columns={8}
      rows={10}
      showStats={true}
      tabs={3}
      actions={2}
      showBackLink={false}
      statBadges={3}
      list="responsive"
    />
  )
}
