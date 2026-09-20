"use client"

import Link from "next/link"
import { AlertTriangle, CalendarClock, FileCode2, Ticket, Wallet, type LucideIcon } from "lucide-react"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Task, LeaveItem, HelpDeskItem, CorrespondenceItem, PaymentItem } from "@/app/(app)/profile/page"
import { countOverdueTasks, isOpenCorrespondence, isOpenTicket, isPendingPayment } from "./work-items"

interface NeedsAttentionProps {
  tasks: Task[]
  leave?: LeaveItem[]
  helpDesk: HelpDeskItem[]
  correspondence: CorrespondenceItem[]
  payments: PaymentItem[]
  annualLeaveRemaining?: number
}

const TONES = {
  red: { iconBgColor: "bg-red-500/10", iconColor: "text-red-600" },
  amber: { iconBgColor: "bg-amber-500/10", iconColor: "text-amber-600" },
  blue: { iconBgColor: "bg-blue-500/10", iconColor: "text-blue-600" },
  muted: { iconBgColor: "bg-muted", iconColor: "text-muted-foreground" },
} as const

interface AttentionItem {
  href: string
  hint: string
  title: string
  value: string | number
  icon: LucideIcon
  tone: keyof typeof TONES
  description: string
}

function AttentionTile({ href, hint, children }: { href: string; hint: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={href}>{children}</Link>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}

export function NeedsAttention({
  tasks,
  helpDesk,
  correspondence,
  payments,
  annualLeaveRemaining = 0,
}: NeedsAttentionProps) {
  const now = new Date()

  const overdueTasks = countOverdueTasks(tasks, now)
  const openTickets = helpDesk.filter(isOpenTicket).length
  const openCorrespondence = correspondence.filter(isOpenCorrespondence).length
  const duePayments = payments.filter(isPendingPayment).length

  // `StatGrid` keeps the first three on a phone, so this order is the mobile
  // choice: overdue work, leave balance, open tickets. Payments and
  // correspondence sit last and show from `sm` up — they are the two a phone
  // reader is least likely to act on from this strip, and both have their own
  // card further down the profile.
  const items: AttentionItem[] = [
    {
      href: "/tasks",
      hint: "Open tasks past their due date",
      title: "Overdue",
      value: overdueTasks,
      icon: AlertTriangle,
      tone: overdueTasks > 0 ? "red" : "muted",
      description: overdueTasks > 0 ? "Needs immediate action" : "All caught up",
    },
    {
      href: "/hr/leave",
      hint: "Your annual leave days remaining for this year",
      title: "Leave Left",
      value: `${annualLeaveRemaining}d`,
      icon: CalendarClock,
      tone: annualLeaveRemaining > 0 ? "blue" : "muted",
      description: annualLeaveRemaining > 0 ? `${annualLeaveRemaining} days remaining` : "None left",
    },
    {
      href: "/help-desk",
      hint: "Help desk tickets not yet resolved, closed, or cancelled",
      title: "Tickets",
      value: openTickets,
      icon: Ticket,
      tone: openTickets > 0 ? "blue" : "muted",
      description: openTickets > 0 ? "Awaiting resolution" : "No open tickets",
    },
    {
      href: "/payments",
      hint: "Payments with status Due or Overdue",
      title: "Payments",
      value: duePayments,
      icon: Wallet,
      tone: duePayments > 0 ? "amber" : "muted",
      description: duePayments > 0 ? "Due or overdue" : "Nothing due",
    },
    {
      href: "/correspondence",
      hint: "Correspondence not yet filed, closed, or cancelled",
      title: "Correspondence",
      value: openCorrespondence,
      icon: FileCode2,
      tone: openCorrespondence > 0 ? "blue" : "muted",
      description: openCorrespondence > 0 ? "Open items" : "Nothing open",
    },
  ]

  return (
    <StatGrid>
      {items.map((item) => (
        <AttentionTile key={item.title} href={item.href} hint={item.hint}>
          <StatCard
            variant="compact"
            title={item.title}
            value={item.value}
            icon={item.icon}
            description={item.description}
            {...TONES[item.tone]}
          />
        </AttentionTile>
      ))}
    </StatGrid>
  )
}
