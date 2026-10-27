import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors the requisition portal: back link, three scope tabs, inline actions,
// four compact stat cards, and the row list it opens on a phone over the table
// it opens on a desktop.
export default function RequisitionLoading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={2}
      columns={7}
      rows={8}
      showStats={true}
      tabs={3}
      actions={2}
      showBackLink={false}
      statBadges={4}
      spacing="tight"
      inlineActions
      list="responsive"
    />
  )
}
