"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
}

/**
 * The one avatar for a person anywhere in the app: their profile photo, or initials in
 * `bg-primary/10` as the fallback. Built on Radix Avatar so an expired signed URL
 * (they last an hour) degrades to initials instead of a broken image.
 */
export function StaffAvatar({ name, src, initials, size = "md", className, fallbackClassName }: StaffAvatarProps) {
  const label = name?.trim() || "Staff member"
  return (
    <Avatar className={cn(STAFF_AVATAR_SIZES[size], className)}>
      {src ? <AvatarImage src={src} alt={label} className="object-cover" /> : null}
      <AvatarFallback className={cn("bg-primary/10 text-primary font-bold", fallbackClassName)}>
        {initials || staffInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
