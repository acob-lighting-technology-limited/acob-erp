export const DEPT_APPROVALS = [
  { page: "hr.leave", key: "approve:hr.leave", label: "Leave approvals" },
  { page: "correspondence", key: "approve:correspondence", label: "Correspondence decisions" },
  { page: "hr.attendance", key: "approve:hr.attendance", label: "Attendance appeal endorsements" },
  { page: "tasks", key: "approve:tasks", label: "Task review" },
] as const

export type ApprovalPage = (typeof DEPT_APPROVALS)[number]["page"]

export function validApprovalPages(pages: string[]) {
  return DEPT_APPROVALS.every(({ key, page }) => !pages.includes(key) || pages.includes(page))
}
