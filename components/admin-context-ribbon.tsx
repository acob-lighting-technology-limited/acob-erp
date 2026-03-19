import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, ArrowLeftRight } from "lucide-react"
import type { UserRole } from "@/types/database"
import { getRoleDisplayName } from "@/lib/permissions"

interface AdminContextRibbonProps {
  role: UserRole
  department?: string | null
}

export function AdminContextRibbon({ role, department }: AdminContextRibbonProps) {
  return (
    <div className="sticky top-16 z-20 border-b border-[var(--admin-sidebar-border)] bg-[var(--admin-ribbon-bg)] px-4 py-2 md:px-6">
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-center gap-2 whitespace-nowrap">
          <Badge
            variant="outline"
            className="border-[var(--admin-badge-border)] bg-[var(--admin-badge-bg)] text-[var(--admin-primary)]"
          >
            <ShieldCheck className="mr-1 h-3 w-3" />
            Admin Console
          </Badge>
          <Badge variant="outline">Role: {getRoleDisplayName(role)}</Badge>
          <Badge variant="outline">Scope: {department || "Organization-wide"}</Badge>
          <Link
            href="/profile"
            className="text-muted-foreground hover:text-foreground ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Switch to User View
          </Link>
        </div>
      </div>
    </div>
  )
}
