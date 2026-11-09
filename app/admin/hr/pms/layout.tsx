import type { ReactNode } from "react"
import { ViewOnlyNotice } from "@/components/admin/view-only-notice"

export default function AdminPmsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ViewOnlyNotice route="hr.main" />
      {children}
    </>
  )
}
