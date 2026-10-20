import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { normalizeDepartmentName } from "@/shared/departments"
import { WeeklyReportsContent } from "@/app/admin/reports/weekly-reports/weekly-reports-content"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

interface DeptWeeklyReportsPageProps {
  params: Promise<{ dept_id: string }>
}

export default async function DeptWeeklyReportsPage({ params }: DeptWeeklyReportsPageProps) {
  const { dept_id } = await params
  const scope = await requireDeptScope(dept_id)

  const deptName = normalizeDepartmentName(scope.deptName)

  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <WeeklyReportsContent
        initialDepartments={[deptName]}
        scopedDepartments={[deptName]}
        editableDepartments={[deptName]}
        currentUser={{
          id: scope.userId,
          role: scope.role,
          department: scope.deptName,
          is_department_lead: true,
          lead_departments: [scope.deptName],
          admin_routes: [],
        }}
      />
    </TablePageLayoutProvider>
  )
}
