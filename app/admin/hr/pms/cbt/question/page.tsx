import type { Metadata } from "next"
import { RequireEditAccess } from "@/components/admin/require-edit-access"
import { CbtQuestionManager } from "@/components/pms/cbt-question-manager"

export const metadata: Metadata = { title: "Admin CBT question" }

export default function AdminPmsCbtQuestionPage() {
  return (
    <RequireEditAccess route="hr.pms.cbt.manage" purpose="change CBT questions">
      <CbtQuestionManager basePath="/admin/hr/pms/cbt" />
    </RequireEditAccess>
  )
}
