import { EditAccessBoundary } from "@/components/admin/edit-access-boundary"

/**
 * Corporate Services (Scorecard, Risk Register). Anyone with the route can open it; changing things is
 * for the area's owners, people acting for them, and overrides.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <EditAccessBoundary route="scorecard.main">{children}</EditAccessBoundary>
}
