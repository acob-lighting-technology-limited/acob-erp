"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, MapPin, User, Zap, FolderKanban } from "lucide-react"

interface ProjectManagerInfo {
  first_name: string
  last_name: string
  company_email: string
}

interface ProjectOverviewCardsProps {
  location: string
  deploymentStartDate: string
  deploymentEndDate: string
  projectManager?: ProjectManagerInfo | null
  capacityW?: number
  technologyType?: string
  formatDate: (dateString: string) => string
}

export function ProjectOverviewCards({
  location,
  deploymentStartDate,
  deploymentEndDate,
  projectManager,
  capacityW,
  technologyType,
  formatDate,
}: ProjectOverviewCardsProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground text-sm font-medium">Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <MapPin className="text-muted-foreground h-5 w-5" />
              <p className="text-lg font-semibold">{location}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground text-sm font-medium">Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="text-muted-foreground h-5 w-5" />
              <div className="text-sm">
                <p className="font-semibold">{formatDate(deploymentStartDate)}</p>
                <p className="text-muted-foreground">to {formatDate(deploymentEndDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground text-sm font-medium">Project Manager</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <User className="text-muted-foreground h-5 w-5" />
              <div className="text-sm">
                {projectManager ? (
                  <>
                    <p className="font-semibold">
                      {projectManager.first_name} {projectManager.last_name}
                    </p>
                    <p className="text-muted-foreground text-xs">{projectManager.company_email}</p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Not assigned</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(capacityW || technologyType) && (
        <div className="grid gap-4 md:grid-cols-2">
          {capacityW && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-muted-foreground text-sm font-medium">Capacity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  <p className="text-lg font-semibold">{capacityW.toLocaleString()} W</p>
                </div>
              </CardContent>
            </Card>
          )}

          {technologyType && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-muted-foreground text-sm font-medium">Technology Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <FolderKanban className="text-muted-foreground h-5 w-5" />
                  <p className="text-lg font-semibold">{technologyType}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
