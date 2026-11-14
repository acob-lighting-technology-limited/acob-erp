import { z } from "zod"
import { CONSOLE_PAGE_KEYS, MAX_DEPT_DELEGATION_DAYS } from "./delegated-pages"
import { DEPT_APPROVALS, validApprovalPages } from "./approval-permissions"

export const adminDelegationKeys = new Set<string>([...CONSOLE_PAGE_KEYS, ...DEPT_APPROVALS.map(({ key }) => key)])

export const delegationFields = z.object({
  departmentId: z.string().uuid(),
  delegateId: z.string().uuid(),
  pages: z
    .array(z.string().refine((page) => adminDelegationKeys.has(page)))
    .min(1)
    .max(adminDelegationKeys.size)
    .refine(validApprovalPages, "Approval permission requires access to its page"),
  validUntil: z.string().datetime({ offset: true }),
})

export function validDelegationEnd(value: string, now: number) {
  const end = Date.parse(value)
  return end > now && end - now <= MAX_DEPT_DELEGATION_DAYS * 86_400_000
}
