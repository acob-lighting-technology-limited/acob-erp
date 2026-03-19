"use client"

import { Fragment, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TableSkeleton } from "@/components/ui/query-states"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/ui/empty-state"
import { QUERY_KEYS } from "@/lib/query-keys"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { StatCard } from "@/components/ui/stat-card"
import { ChevronDown, ChevronUp, Mail, MapPin, Pencil, Users } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { isAssignableEmploymentStatus } from "@/lib/workforce/assignment-policy"

interface OfficeLocationsData {
  locations: OfficeLocationRow[]
  locationEmployees: Record<string, LocationEmployee[]>
}

async function fetchOfficeLocations(): Promise<OfficeLocationsData> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, company_email, additional_email, company_role, office_location, employment_status"
    )

  if (error) throw new Error(error.message)

  const byLocation: Record<string, LocationEmployee[]> = {}
  for (const profile of ((data || []) as Array<LocationEmployee & { employment_status?: string | null }>).filter(
    (employee) => isAssignableEmploymentStatus(employee.employment_status, { allowLegacyNullStatus: false })
  )) {
    const locationName = profile.office_location?.trim() || "Unassigned"
    if (!byLocation[locationName]) byLocation[locationName] = []
    byLocation[locationName].push(profile)
  }

  const rows = Object.entries(byLocation)
    .map(([name, members]) => ({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      employee_count: members.length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return { locations: rows, locationEmployees: byLocation }
}

interface LocationEmployee {
  id: string
  first_name: string | null
  last_name: string | null
  company_email: string | null
  additional_email: string | null
  company_role: string | null
  office_location: string | null
}

interface OfficeLocationRow {
  id: string
  name: string
  employee_count: number
}

export default function OfficeLocationsPage() {
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set())

  const { data, isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.adminOfficeLocations(),
    queryFn: fetchOfficeLocations,
  })

  const locations = data?.locations ?? []
  const locationEmployees = data?.locationEmployees ?? {}

  function toggleLocationRow(locationId: string) {
    setExpandedLocations((prev) => {
      const next = new Set(prev)
      if (next.has(locationId)) next.delete(locationId)
      else next.add(locationId)
      return next
    })
  }

  return (
    <AdminTablePage
      title="Office Locations"
      description="View office locations and the employees assigned to each location"
      icon={MapPin}
      backLinkHref="/admin/hr"
      backLinkLabel="Back to HR"
    >
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 md:gap-4">
        <StatCard title="Total Office Locations" value={locations.length} icon={MapPin} />
        <StatCard
          title="Total Employees"
          value={locations.reduce((sum, l) => sum + l.employee_count, 0)}
          icon={Users}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Office Locations</CardTitle>
          <CardDescription>Expand a location to see employees assigned there</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} cols={3} />
          ) : locations.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No office locations yet"
              description="No active employees have an office location assigned."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-14"></TableHead>
                  <TableHead>Office Location</TableHead>
                  <TableHead>Employees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location, index) => {
                  const isExpanded = expandedLocations.has(location.id)
                  const members = locationEmployees[location.name] || []

                  return (
                    <Fragment key={location.id}>
                      <TableRow
                        className={cn(
                          "hover:bg-muted/30 cursor-pointer transition-colors",
                          isExpanded && "bg-muted/50"
                        )}
                        onClick={() => toggleLocationRow(location.id)}
                      >
                        <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleLocationRow(location.id)
                            }}
                            className="h-7 w-7"
                            aria-label={isExpanded ? `Collapse ${location.name}` : `Expand ${location.name}`}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{location.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{location.employee_count} employees</Badge>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-muted/10 hover:bg-muted/10 border-t-0">
                          <TableCell colSpan={4} className="p-0">
                            {members.length === 0 ? (
                              <p className="text-muted-foreground px-6 py-3 text-sm">
                                No employees in this office location.
                              </p>
                            ) : (
                              <div className="animate-in slide-in-from-top-2 p-6 pt-2 duration-200">
                                <div className="bg-background overflow-hidden rounded-lg border shadow-sm">
                                  <Table>
                                    <TableHeader className="bg-muted/30">
                                      <TableRow>
                                        <TableHead className="text-muted-foreground w-[70px] text-[10px] font-black tracking-widest uppercase">
                                          S/N
                                        </TableHead>
                                        <TableHead className="text-muted-foreground text-[10px] font-black tracking-widest uppercase">
                                          Employee
                                        </TableHead>
                                        <TableHead className="text-muted-foreground text-[10px] font-black tracking-widest uppercase">
                                          Contact
                                        </TableHead>
                                        <TableHead className="text-muted-foreground w-[180px] text-[10px] font-black tracking-widest uppercase">
                                          Role
                                        </TableHead>
                                        <TableHead className="w-[80px] text-right"></TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {members.map((member, memberIndex) => (
                                        <TableRow key={member.id} className="hover:bg-muted/5">
                                          <TableCell className="text-muted-foreground text-xs font-semibold">
                                            {memberIndex + 1}
                                          </TableCell>
                                          <TableCell className="text-sm font-semibold">
                                            {[member.first_name, member.last_name].filter(Boolean).join(" ") ||
                                              "Unknown"}
                                          </TableCell>
                                          <TableCell className="text-muted-foreground text-xs">
                                            <div className="flex items-center gap-2">
                                              <Mail className="h-3 w-3" />
                                              <span className="truncate">
                                                {[member.company_email, member.additional_email]
                                                  .filter(Boolean)
                                                  .join(" | ")}
                                              </span>
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                              {member.company_role || "Employee"}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <Link href={`/admin/hr/employees?userId=${member.id}`}>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                aria-label="Edit employee office location"
                                                title="Edit employee office location"
                                              >
                                                <Pencil className="h-4 w-4" />
                                              </Button>
                                            </Link>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminTablePage>
  )
}
