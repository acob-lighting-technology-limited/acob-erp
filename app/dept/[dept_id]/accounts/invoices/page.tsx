import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { InvoicesPage as AdminAccountsInvoicesPage } from "@/app/admin/accounts/invoices/view"

export const metadata: Metadata = { title: "Dept Invoices" }
import type { Metadata } from "next"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptAccountsInvoicesPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return (
    <AdminAccountsInvoicesPage
      backLinkHref={`/dept/${dept_id}/accounts`}
      financeBasePath={`/dept/${dept_id}/accounts`}
    />
  )
}
