import { redirect } from "next/navigation"

/**
 * Root of the System & Security group. It has no page of its own; the sidebar
 * item points here so the branch follows the same parent-is-the-hub convention
 * as every other group, instead of borrowing its first child's href.
 */
export default function Page() {
  redirect("/admin/audit-logs")
}
