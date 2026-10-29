import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors HelpDeskContent: back link, three scope tabs, inline actions, four
// compact stat cards, and the row list it opens on a phone over the table it
// opens on a desktop.
export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={3}
      filters={3}
      columns={7}
      rows={8}
      showStats={true}
      tabs={3}
      actions={0}
      showBackLink={false}
      statBadges={3}
      spacing="tight"
      inlineActions
      list="responsive"
    />
  )
}
