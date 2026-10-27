"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { EmploymentStatus } from "@/types/database"
import { Circle, AlertTriangle, XCircle, Clock, FileText } from "lucide-react"

interface EmployeeStatusBadgeProps {
  status: EmploymentStatus
  showIcon?: boolean
  size?: "sm" | "default" | "lg"
  className?: string
}

const statusConfig: Record<
  EmploymentStatus,
  {
    label: string
    variant: "default" | "secondary" | "destructive" | "outline"
    color: string
    bgColor: string
    icon: typeof Circle
  }
> = {
  active: {
    label: "Active",
    variant: "default",
    color: "text-success",
    bgColor: "bg-success/15 border-success/30",
    icon: Circle,
  },
  suspended: {
    label: "Suspended",
    variant: "secondary",
    color: "text-warning",
    bgColor: "bg-warning/15 border-warning/30",
    icon: AlertTriangle,
  },
  exited: {
    label: "Exited",
    variant: "destructive",
    color: "text-danger",
    bgColor: "bg-danger/15 border-danger/30",
    icon: XCircle,
  },
  on_leave: {
    label: "On Leave",
    variant: "outline",
    color: "text-info",
    bgColor: "bg-info/15 border-info/30",
    icon: Clock,
  },
  contract: {
    label: "Contract",
    variant: "secondary",
    color: "text-purple",
    bgColor: "bg-purple/15 border-purple/30",
    icon: FileText,
  },
}

const sizeClasses = {
  sm: "text-xs px-1.5 py-0.5",
  default: "text-xs px-2 py-1",
  lg: "text-sm px-2.5 py-1",
}

export function EmployeeStatusBadge({
  status,
  showIcon = true,
  size = "default",
  className,
}: EmployeeStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.active
  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={cn("border font-medium whitespace-nowrap", config.bgColor, config.color, sizeClasses[size], className)}
    >
      {showIcon && <Icon className={cn("mr-1", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />}
      {config.label}
    </Badge>
  )
}

export function getStatusColor(status: EmploymentStatus): string {
  return statusConfig[status]?.color || statusConfig.active.color
}

export function getStatusLabel(status: EmploymentStatus): string {
  return statusConfig[status]?.label || "Unknown"
}
