import type { Metadata } from "next"
import { AppLayout } from "@/components/app-layout"

export const metadata: Metadata = {
  title: "Job Description | ACOB Lighting Technology Limited",
  description: "Manage your job description",
}

export default function JobDescriptionLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
