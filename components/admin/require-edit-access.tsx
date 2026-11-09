"use client"

import { Eye } from "lucide-react"
import { useCanEdit } from "@/components/admin/edit-access-context"

interface RequireEditAccessProps {
  /** The admin route key that decides edit access, e.g. "hr.pms.cbt.manage". */
  route: string
  /** What this screen is for, in a few words: "manage CBT questions". */
  purpose: string
  children: React.ReactNode
}

/**
 * For screens that exist only to change things (an authoring tool, a bulk editor). A person
 * with view access only sees why instead of a form they cannot save. Anyone outside the
 * HR / IT layouts, such as a department lead in their own console, sees the screen as before.
 */
export function RequireEditAccess({ route, purpose, children }: RequireEditAccessProps) {
  const canEdit = useCanEdit(route)
  if (canEdit) return <>{children}</>
  return (
    <div className="bg-muted/50 text-muted-foreground mx-4 mt-6 flex items-start gap-3 rounded-lg border p-4 text-sm md:mx-6">
      <Eye className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <span className="text-foreground font-medium">View only.</span> You can see this area but cannot {purpose}. The
        people named above can.
      </p>
    </div>
  )
}
