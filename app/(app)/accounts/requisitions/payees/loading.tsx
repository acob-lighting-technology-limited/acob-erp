import { TablePageSkeleton } from "@/components/skeletons"

// Header with back link and actions, four compact stat cards, then the table.
export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={1}
      columns={6}
      rows={8}
      showStats={true}
      actions={2}
      showBackLink={true}
      spacing="tight"
      inlineActions
    />
  )
}
