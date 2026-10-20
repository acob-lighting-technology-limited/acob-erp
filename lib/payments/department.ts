import { DEPT_ACCOUNTS, normalizeDepartmentName } from "@/shared/departments"

/** Canonical, case-insensitive department key for comparing payment ownership. */
export function normalizeDepartment(value: string | null | undefined): string {
  return normalizeDepartmentName(String(value || "").trim()).toLowerCase()
}

/** Accounts (finance) staff may see every department's payments. */
export function isFinanceDepartment(value: string | null | undefined): boolean {
  return normalizeDepartment(value) === normalizeDepartment(DEPT_ACCOUNTS)
}
