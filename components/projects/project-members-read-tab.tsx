"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, Users } from "lucide-react"
import { EmptyState } from "@/components/ui/patterns"

interface ProjectMemberUser {
  first_name: string
  last_name: string
  company_email: string
  department: string
}

interface ProjectMemberReadOnly {
  id: string
  user: ProjectMemberUser
  role: string
  assigned_at: string
}

interface ProjectMembersReadTabProps {
  members: ProjectMemberReadOnly[]
}

export function ProjectMembersReadTab({ members }: ProjectMembersReadTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Members</CardTitle>
        <CardDescription>Team members assigned to this project</CardDescription>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <EmptyState
            title="No members assigned to this project yet"
            description="Assign members to start collaboration on this project."
            icon={Users}
            className="border-0"
          />
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
                    <User className="text-primary h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {member.user.first_name} {member.user.last_name}
                    </p>
                    <p className="text-muted-foreground text-sm">{member.user.company_email}</p>
                    <p className="text-muted-foreground text-xs">{member.user.department}</p>
                  </div>
                </div>
                <Badge variant="outline">{member.role}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
