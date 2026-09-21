"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Award, Brain, CheckCircle2, Clock3, MessageSquare, ShieldCheck, Target, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { pmsNavChildren } from "@/lib/pms/sections"

const PMS_NAV_ICONS: Record<string, React.ElementType> = {
  goals: CheckCircle2,
  kpi: Target,
  reviews: Award,
  "peer-feedback": MessageSquare,
  "development-plans": Award,
  behaviour: ShieldCheck,
  cbt: Brain,
  attendance: Clock3,
}

// Order comes from PMS_SECTIONS so this sub-nav and the sidebar, which are on
// screen together, cannot drift apart.
const PMS_NAV_ITEMS = [
  { label: "Overview", href: "/pms", icon: TrendingUp },
  ...pmsNavChildren("/pms", { staffOnly: true }).map((child) => ({
    label: child.name,
    href: child.href,
    icon: PMS_NAV_ICONS[child.href.split("/").pop() || ""] ?? TrendingUp,
  })),
]

/**
 * Persistent sub-nav for every /pms/* page, so moving between KPI, Goals,
 * Attendance, CBT, Behaviour, Reviews, Development Plans and Peer Feedback
 * doesn't mean going back to the /pms overview each time.
 */
export function PmsNav() {
  const pathname = usePathname()

  return (
    <nav className="border-border/60 bg-background/60 mb-4 overflow-x-auto rounded-lg border px-2 backdrop-blur">
      <div className="flex min-w-max gap-1 py-1.5">
        {PMS_NAV_ITEMS.map((item) => {
          const isActive = item.href === "/pms" ? pathname === "/pms" : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
