import { EditAccessBoundary } from "@/components/admin/edit-access-boundary"

/**
 * MD's Desk follows the same pattern as HR, IT and Corporate Services: its owner (the MD), people
 * acting for the owner, overrides given by the owner, and everyone else view only. The database
 * decides who can write its data; this shows each person where they stand.
 */
export default function AdminMdDeskLayout({ children }: { children: React.ReactNode }) {
  return <EditAccessBoundary route="mddesk.main">{children}</EditAccessBoundary>
}
