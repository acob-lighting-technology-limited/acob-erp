import { EditAccessBoundary } from "@/components/admin/edit-access-boundary"

/**
 * The IT console. Each page is gated by its own route key in middleware (it.main, or
 * security.networkActivity / security.bypassOverride); this layout tells someone who can
 * view but not change IT's pages who can.
 */
export default function AdminItLayout({ children }: { children: React.ReactNode }) {
  return <EditAccessBoundary route="it.main">{children}</EditAccessBoundary>
}
