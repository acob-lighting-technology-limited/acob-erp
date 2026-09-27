import { TablePageSkeleton } from "@/components/skeletons"

export default function EmployeesLoading() {
  return <TablePageSkeleton tabs={4} filters={3} columns={6} rows={10} showStats={true} statCards={4} actions={2} />
}
