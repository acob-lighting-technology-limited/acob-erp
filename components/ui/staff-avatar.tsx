"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { StaffCardDialog, staffCardQueryOptions } from "@/components/ui/staff-card-dialog"
import { cn } from "@/lib/utils"

const STAFF_AVATAR_SIZES = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-8 w-8 text-[10px]",
  md: "h-9 w-9 text-[11px]",
  lg: "h-12 w-12 text-sm",
  xl: "h-16 w-16 text-lg",
} as const

export type StaffAvatarSize = keyof typeof STAFF_AVATAR_SIZES

/** Two-letter initials from a display name ("Ilonze, Chibuikem" or "Chibuikem Ilonze") or an email. */
export function staffInitials(name: string | null | undefined): string {
  const cleaned = (name ?? "")
    .split("@")[0]
    .replace(/[,._-]+/g, " ")
    .trim()
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (cleaned.slice(0, 2) || "?").toUpperCase()
}

interface StaffAvatarProps {
  /** Display name (or email) — used for the alt text and the initials fallback. */
  name: string | null | undefined
  /** Signed profile photo URL. Null/undefined or a failed load falls back to initials. */
  src?: string | null
  /** Override the derived initials (e.g. when first/last name are known separately). */
  initials?: string
  size?: StaffAvatarSize
  className?: string
  fallbackClassName?: string
  /**
   * The person's profile id. When set, clicking the avatar opens their contact card
   * (photo, name, email, phone). Leave it unset where the avatar sits inside another
   * button (mobile list rows, account menus) — a button can't nest a button.
   */
  profileId?: string | null
}

/**
 * The one avatar for a person anywhere in the app: their profile photo, or initials in
 * `bg-primary/10` as the fallback. Built on Radix Avatar so an expired signed URL
 * (they last an hour) degrades to initials instead of a broken image.
 */
export function StaffAvatar({
  name,
  src,
  initials,
  size = "md",
  className,
  fallbackClassName,
  profileId,
}: StaffAvatarProps) {
  const [cardOpen, setCardOpen] = useState(false)
  const queryClient = useQueryClient()
  const label = name?.trim() || "Staff member"
  const avatar = (
    <Avatar className={cn(STAFF_AVATAR_SIZES[size], className)}>
      {src ? <AvatarImage src={src} alt={label} className="object-cover" /> : null}
      <AvatarFallback className={cn("bg-primary/10 text-primary font-bold", fallbackClassName)}>
        {initials || staffInitials(name)}
      </AvatarFallback>
    </Avatar>
  )

  if (!profileId) return avatar

  // Start loading the card on hover/touch/focus so it's usually ready by the click.
  const prefetchCard = () => void queryClient.prefetchQuery(staffCardQueryOptions(profileId))

  return (
    <>
      <button
        type="button"
        aria-label={`View ${label}'s contact card`}
        // Avatars often sit in clickable table rows; the card shouldn't also open the row.
        onPointerEnter={prefetchCard}
        onFocus={prefetchCard}
        onClick={(event) => {
          event.stopPropagation()
          setCardOpen(true)
        }}
        className="focus-visible:ring-ring inline-flex shrink-0 cursor-pointer rounded-full transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
      >
        {avatar}
      </button>
      {cardOpen && (
        <StaffCardDialog profileId={profileId} open={cardOpen} onOpenChange={setCardOpen} name={name} src={src} />
      )}
    </>
  )
}

interface StaffNameWithAvatarProps {
  name: string
  profileId: string | null | undefined
  /** From `useStaffAvatars()`; people without a photo show initials. */
  src?: string | null
  className?: string
}

/** A person's small photo followed by their name — for "Submitted by"-style table cells. */
export function StaffNameWithAvatar({ name, profileId, src, className }: StaffNameWithAvatarProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <StaffAvatar name={name} src={src} profileId={profileId} size="xs" />
      <span className="truncate">{name}</span>
    </span>
  )
}
