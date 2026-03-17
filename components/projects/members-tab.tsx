"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, User, UserPlus, Trash2 } from "lucide-react"
import { EmptyState } from "@/components/ui/patterns"
import type { ProjectMember } from "./project-data"

interface MembersTabProps {
  members: ProjectMember[]
  projectManagerId?: string | null
  onAddMember: () => void
  onRemoveMember: (member: ProjectMember) => void
}

export function MembersTab({ members, projectManagerId, onAddMember, onRemoveMember }: MembersTabProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Project Members</CardTitle>
          <CardDescription>Manage team members assigned to this project</CardDescription>
        </div>
        <Button onClick={onAddMember}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Member
        </Button>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <EmptyState
            title="No members assigned yet"
            description='Click "Add Member" to get started.'
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
                <div className="flex items-center gap-2">
                  {member.user_id === projectManagerId ? (
                    <Badge>Project Manager</Badge>
                  ) : (
                    <Badge variant="outline">{member.role === "manager" ? "member" : member.role}</Badge>
                  )}
                  <Button variant="outline" size="icon" onClick={() => onRemoveMember(member)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
