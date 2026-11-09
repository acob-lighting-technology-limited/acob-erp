import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Finance",
  description: "Manage finance in the admin dashboard.",
}

/**
 * Payroll, Inventory and Assets live under /admin/accounts but keep their own grantable
 * route keys (payroll.main, inventory.main, assets.main), so an admin granted only one of
 * them reaches it. Middleware gates every /admin page by its route key, and each of those
 * three sections re-checks its own layout, so this one no longer requires the Accounts
 * grant for everything beneath it.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
