"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ProfileForm } from "@/components/profile-form"
import type { UserProfile } from "@/app/(app)/profile/page"
import type { Database } from "@/types/database"

type ProfileRecord = Database["public"]["Tables"]["profiles"]["Row"] & {
  email_notifications?: boolean | null
}

interface ProfileEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: UserProfile
}

export function ProfileEditDialog({ open, onOpenChange, profile }: ProfileEditDialogProps) {
  const dialogProfile = profile as unknown as ProfileRecord

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Update your personal and professional information without leaving this page.</DialogDescription>
        </DialogHeader>
        <ProfileForm
          user={{ id: profile.id }}
          profile={dialogProfile}
          hideBackButton
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
