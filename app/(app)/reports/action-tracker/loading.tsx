import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors the Action Tracker: back link, Weekly / Directives tabs, inline
// actions, five compact stat cards, and the row list it opens on a phone over
// the table it opens on a desktop.
export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={5}
      filters={4}
      columns={4}
      rows={8}
      showStats={true}
      tabs={2}
      actions={2}
      showBackLink
      statBadges={5}
      spacing="tight"
      inlineActions
      list="responsive"
    />
  )
}
