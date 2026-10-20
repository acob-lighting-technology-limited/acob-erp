"use client"

import { Circle, AlertTriangle, XCircle, Clock, FileText, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { StatusTone } from "@/lib/status-tones"
import type { EmploymentStatus } from "@/types/database"

interface EmployeeStatusBadgeProps {
  status: EmploymentStatus
  showIcon?: boolean
  size?: "sm" | "default" | "lg"
  className?: string
}

const STATUS_CONFIG: Record<EmploymentStatus, { label: string; tone: StatusTone; icon: LucideIcon }> = {
  active: { label: "Active", tone: "success", icon: Circle },
  suspended: { label: "Suspended", tone: "warning", icon: AlertTriangle },
  exited: { label: "Exited", tone: "danger", icon: XCircle },
  on_leave: { label: "On Leave", tone: "info", icon: Clock },
  contract: { label: "Contract", tone: "neutral", icon: FileText },
}

const SIZE_CLASSES = {
  sm: "px-1.5 py-0.5 text-xs",
  default: "px-2 py-1 text-xs",
  lg: "px-2.5 py-1 text-sm",
}

export function EmployeeStatusBadge({
  status,
  showIcon = true,
  size = "default",
  className,
}: EmployeeStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active
  const Icon = config.icon
  return (
    <Badge variant={config.tone} className={cn("font-medium", SIZE_CLASSES[size], className)}>
      {showIcon && <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />}
      {config.label}
    </Badge>
  )
}
