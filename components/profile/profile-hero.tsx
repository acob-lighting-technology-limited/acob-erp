"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Edit, Briefcase, Building2, Clock } from "lucide-react"
import { formatName } from "@/lib/utils"
import { getRoleDisplayName } from "@/lib/permissions"
import type { UserRole } from "@/types/database"

interface ProfileHeroProps {
  profile: {
    first_name?: string | null
    last_name?: string | null
    other_names?: string | null
    company_role?: string | null
    department?: string | null
    role: string
    is_department_lead?: boolean | null
    employment_date?: string | null
  }
}

const roleColors: Record<string, { bg: string; border: string; dot: string; text: string }> = {
  super_admin: {
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
  admin: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    dot: "bg-purple-500",
    text: "text-purple-600 dark:text-purple-400",
  },
  lead: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
  },
  employee: {
    bg: "bg-gray-500/10",
    border: "border-gray-500/20",
    dot: "bg-gray-500",
    text: "text-gray-600 dark:text-gray-400",
  },
  visitor: {
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
    dot: "bg-slate-500",
    text: "text-slate-600 dark:text-slate-400",
  },
}

function getInitials(firstName?: string | null, lastName?: string | null): string {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase()
}

export function ProfileHero({ profile }: ProfileHeroProps) {
  const router = useRouter()

  const employmentDate = profile.employment_date ? new Date(profile.employment_date) : null
  const daysAtAcob = employmentDate ? Math.floor((Date.now() - employmentDate.getTime()) / (1000 * 60 * 60 * 24)) : null

  const colors = roleColors[profile.role] || roleColors.employee

  return (
    <Card className="relative overflow-hidden">
      <Button
        onClick={() => router.push("/profile/edit")}
        variant="outline"
        className="bg-background/80 absolute top-4 right-4 z-10 gap-2 backdrop-blur-sm"
      >
        <Edit className="h-4 w-4" />
        Edit Profile
      </Button>

      <div className="bg-primary/10 h-28 md:h-36 lg:h-44" />

      <CardContent className="relative px-6 pb-6">
        <div className="-mt-14 flex items-end gap-4 md:-mt-16 lg:-mt-20 lg:gap-6">
          <Avatar className="border-background h-28 w-28 border-4 shadow-lg md:h-32 md:w-32 lg:h-40 lg:w-40">
            <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold md:text-4xl lg:text-5xl">
              {getInitials(profile.first_name, profile.last_name)}
            </AvatarFallback>
          </Avatar>
          <div className="pb-2 lg:pb-4">
            <h1 className="text-xl font-bold md:text-2xl lg:text-3xl">
              {formatName(profile.first_name)}
              {profile.other_names && ` ${formatName(profile.other_names)}`}
              {` ${formatName(profile.last_name)}`}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5">
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm md:text-base lg:text-lg">
                <Briefcase className="h-4 w-4 lg:h-5 lg:w-5" />
                {profile.company_role || "employee Member"}
              </p>
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm md:text-base lg:text-lg">
                <Building2 className="h-4 w-4 lg:h-5 lg:w-5" />
                {profile.department || "Unassigned Department"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${colors.bg} border ${colors.border}`}>
            <div className={`h-2 w-2 rounded-full ${colors.dot} animate-pulse`} />
            <span className={`text-sm font-semibold ${colors.text}`}>
              {getRoleDisplayName(profile.role as UserRole)}
            </span>
          </div>

          {profile.is_department_lead && (
            <div className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Department Lead</span>
            </div>
          )}

          <Badge variant="outline" className="text-muted-foreground">
            <Clock className="mr-1 h-3 w-3" />
            {daysAtAcob !== null ? `${daysAtAcob} days at ACOB` : "Set join date"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
