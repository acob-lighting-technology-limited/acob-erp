import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { OnboardingContent } from "./onboarding-content"

import type { Metadata } from "next"

export const metadata: Metadata = { title: "Admin Onboarding" }

export default async function OnboardingPage() {
  await requireAdminSectionAccess("settings")

  return <OnboardingContent />
}
