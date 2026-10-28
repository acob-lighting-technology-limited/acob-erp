import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { ControlledDocsRegister } from "@/components/documentation/controlled/controlled-docs-register"

export const metadata: Metadata = { title: "Dept SOPs" }
import type { Metadata } from "next"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function Page({ params }: Props) {
  const { dept_id } = await params
  const scope = await requireDeptScope(dept_id)

  return (
    <ControlledDocsRegister
      type="sop"
      departmentName={scope.deptName}
      backLink={{ href: `/dept/${dept_id}/documentation`, label: "Back to Documentation" }}
    />
  )
}
