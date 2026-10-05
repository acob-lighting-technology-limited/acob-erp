"use client"

import { queryOptions, useQuery } from "@tanstack/react-query"
import { Mail, Phone } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { staffInitials } from "@/components/ui/staff-avatar"
import { QUERY_KEYS } from "@/lib/query-keys"
import { cn } from "@/lib/utils"

interface StaffCard {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  department: string | null
  designation: string | null
}

async function fetchStaffCard(id: string): Promise<StaffCard> {
  const response = await fetch(`/api/staff/${id}`, { credentials: "same-origin" })
  if (!response.ok) throw new Error("Failed to load staff member")
  const payload = (await response.json()) as { data: StaffCard }
  return payload.data
}

/** Shared by the dialog and the avatar's hover prefetch, so both hit the same cache entry. */
export function staffCardQueryOptions(profileId: string) {
  return queryOptions({
    queryKey: QUERY_KEYS.staffCard(profileId),
    queryFn: () => fetchStaffCard(profileId),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })
}

interface StaffCardDialogProps {
  profileId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Shown straight away from what the caller already has, while the card loads. */
  name: string | null | undefined
  src?: string | null
}

/** A colleague's photo with their name, email and phone — opened by clicking a `StaffAvatar`. */
export function StaffCardDialog({ profileId, open, onOpenChange, name, src }: StaffCardDialogProps) {
  const { data, isLoading, isError } = useQuery({ ...staffCardQueryOptions(profileId), enabled: open })

  const displayName = data?.name || name?.trim() || "Staff member"
  const photo = src ?? null
  const role = [data?.designation, data?.department].filter(Boolean).join(" · ")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Portalled content still bubbles React events to the avatar's ancestors, which
          are often clickable table rows — stop clicks here so they don't open the row. */}
      <DialogContent className="sm:max-w-sm" onClick={(event) => event.stopPropagation()}>
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <div className="bg-primary/10 text-primary mb-2 flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border text-4xl font-bold shadow-sm">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed private-bucket URL
              <img src={photo} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              staffInitials(displayName)
            )}
          </div>
          <DialogTitle className="text-xl">{displayName}</DialogTitle>
          <DialogDescription>{role || (isLoading ? " " : "ACOB staff")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </>
          ) : isError ? (
            <p className="text-muted-foreground text-center text-sm">Couldn&apos;t load contact details.</p>
          ) : (
            <>
              <ContactRow icon={Mail} label="Email" value={data?.email} href={data?.email && `mailto:${data.email}`} />
              <ContactRow icon={Phone} label="Phone" value={data?.phone} href={data?.phone && `tel:${data.phone}`} />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Mail
  label: string
  value: string | null | undefined
  href: string | null | undefined
}) {
  const content = (
    <>
      <Icon className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="text-muted-foreground block text-[11px] font-medium tracking-wide uppercase">{label}</span>
        <span className={cn("block text-sm", value ? "truncate" : "text-muted-foreground")}>
          {value || "Not provided"}
        </span>
      </span>
    </>
  )

  const className = "flex items-center gap-3 rounded-lg border px-3 py-2"
  return href ? (
    <a href={href} className={cn(className, "hover:bg-muted/50 transition-colors")}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  )
}
