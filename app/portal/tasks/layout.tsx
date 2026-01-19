import type { Metadata } from "next"
import { AppLayout } from "@/components/app-layout"

export const metadata: Metadata = {
  title: "My Tasks | ACOB Lighting Technology Limited",
  description: "Manage your assigned tasks and track progress",
}

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
