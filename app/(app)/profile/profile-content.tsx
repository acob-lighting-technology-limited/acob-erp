"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { ProfileHero } from "@/components/profile/profile-hero"
import { ProfileEditDialog } from "@/components/profile/profile-edit-dialog"
import { ContactInfoCard } from "@/components/profile/contact-info-card"
import { QuickActionsCard } from "@/components/profile/quick-actions-card"
import { ActivityTabs } from "@/components/profile/activity-tabs"
import type { UserProfile, Task, Asset, Documentation, Feedback } from "./page"

interface ProfileContentProps {
  profile: UserProfile | null
  tasks: Task[]
  assets: Asset[]
  documentation: Documentation[]
  feedback: Feedback[]
  initialError?: string | null
}

export function ProfileContent({ profile, tasks, assets, documentation, feedback, initialError }: ProfileContentProps) {
  const [isEditOpen, setIsEditOpen] = useState(false)

  useEffect(() => {
    if (initialError) {
      toast.error(initialError)
    }
  }, [initialError])

  if (!profile) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">Profile not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-full space-y-6 p-4 md:p-6 lg:p-8">
      <ProfileHero profile={profile} onEdit={() => setIsEditOpen(true)} />
      <ContactInfoCard profile={profile} />
      <QuickActionsCard />
      <ActivityTabs tasks={tasks} assets={assets} documentation={documentation} feedback={feedback} />
      <ProfileEditDialog open={isEditOpen} onOpenChange={setIsEditOpen} profile={profile} />
    </div>
  )
}
