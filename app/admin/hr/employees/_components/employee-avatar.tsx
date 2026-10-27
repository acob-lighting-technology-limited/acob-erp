"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Employee } from "../admin-employee-content"

const AVATAR_SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-16 w-16 text-lg",
} as const

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (name.slice(0, 2) || "AC").toUpperCase()
}

export function EmployeeAvatar({ employee, size = "md" }: { employee: Employee; size?: keyof typeof AVATAR_SIZES }) {
  const fullName = `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || employee.company_email || "User"
  return (
    <Avatar className={cn("shrink-0", AVATAR_SIZES[size])}>
      {employee.avatar_url ? <AvatarImage src={employee.avatar_url} alt={fullName} className="object-cover" /> : null}
      <AvatarFallback className="bg-primary/10 text-primary font-bold">{getInitials(fullName)}</AvatarFallback>
    </Avatar>
  )
}
