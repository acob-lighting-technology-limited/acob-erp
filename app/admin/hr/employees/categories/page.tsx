import { Tags } from "lucide-react"
import { ContractCategoriesPageContent } from "@/components/hr/manage-contract-categories-dialog"
import { PageHeader, PageWrapper } from "@/components/layout"

export const metadata = { title: "Contract Categories" }

export default function CategoriesPage() {
  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Categories"
        description="Manage the contract categories used for employee staff ID series."
        icon={Tags}
      />
      <ContractCategoriesPageContent />
    </PageWrapper>
  )
}
