"use client"

import { Fragment, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronDown, ChevronUp, Mail, MapPin, Pencil, Plus, Users } from "lucide-react"
import { toast } from "sonner"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/empty-state"
import { TableSkeleton } from "@/components/ui/query-states"
import { QUERY_KEYS } from "@/lib/query-keys"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { isAssignableEmploymentStatus } from "@/lib/workforce/assignment-policy"
import { logger } from "@/lib/logger"

const log = logger("hr-office-locations")

const OFFICE_TYPE_OPTIONS = [
  { value: "office", label: "Executive Office" },
  { value: "department_office", label: "Department Office" },
  { value: "conference_room", label: "Conference Room" },
  { value: "common_area", label: "Common Area" },
]

interface OfficeLocation {
  id: string
  name: string
  type: string
  department: string | null
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  employee_count?: number
}

interface LocationEmployee {
  id: string
  first_name: string | null
  last_name: string | null
  company_email: string | null
  additional_email: string | null
  designation: string | null
  office_location: string | null
  employment_status?: string | null
}

interface OfficeLocationsData {
  locations: OfficeLocation[]
  locationEmployees: Record<string, LocationEmployee[]>
  canManageLocations: boolean
  departments: string[]
}

async function fetchOfficeLocationsData(): Promise<OfficeLocationsData> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let canManageLocations = false
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    canManageLocations = ["developer", "super_admin", "admin"].includes(profile?.role || "")
  }

  const [{ data: locs, error }, { data: depts }] = await Promise.all([
    supabase.from("office_locations").select("*").order("name"),
    supabase.from("departments").select("name").eq("is_active", true).order("name"),
  ])
  if (error) throw new Error(error.message)

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, company_email, additional_email, designation, office_location, employment_status"
    )

  const byLocation: Record<string, LocationEmployee[]> = {}
  for (const profile of (profiles || ([] as LocationEmployee[])).filter((employee) =>
    isAssignableEmploymentStatus(employee.employment_status, { allowLegacyNullStatus: false })
  )) {
    const locName = profile.office_location?.trim() || "Unassigned"
    if (!byLocation[locName]) byLocation[locName] = []
    byLocation[locName].push(profile)
  }

  const locsWithCounts = (locs || []).map((loc) => ({
    ...loc,
    employee_count: byLocation[loc.name]?.length || 0,
  }))

  return {
    locations: locsWithCounts,
    locationEmployees: byLocation,
    canManageLocations,
    departments: (depts || []).map((d) => d.name),
  }
}

export default function OfficeLocationsPage() {
  const queryClient = useQueryClient()
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set())
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<OfficeLocation | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    type: "office",
    department: "",
    description: "",
    is_active: true,
  })

  const { data, isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.adminOfficeLocations(),
    queryFn: fetchOfficeLocationsData,
  })

  const locations = data?.locations ?? []
  const locationEmployees = data?.locationEmployees ?? {}
  const canManageLocations = data?.canManageLocations ?? false
  const departments = data?.departments ?? []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (!canManageLocations) {
        toast.error("You can view office locations but cannot modify them")
        return
      }

      const supabase = createClient()

      if (editingLocation) {
        const newName = formData.name.trim()

        const { error, data: updatedRows } = await supabase
          .from("office_locations")
          .update({
            name: newName,
            type: formData.type,
            department: formData.department || null,
            description: formData.description || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingLocation.id)
          .select()

        if (error) throw error
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error(
            "Update was blocked by a database policy. Check that your account has permission to modify office locations."
          )
        }

        toast.success("Office location updated successfully")
      } else {
        const { error } = await supabase.from("office_locations").insert({
          name: formData.name.trim(),
          type: formData.type,
          department: formData.department || null,
          description: formData.description || null,
          is_active: formData.is_active,
        })

        if (error) throw error
        toast.success("Office location created successfully")
      }

      setIsDialogOpen(false)
      setEditingLocation(null)
      setFormData({ name: "", type: "office", department: "", description: "", is_active: true })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOfficeLocations() })
    } catch (error: unknown) {
      log.error("Error saving office location:", error)
      const msg =
        error instanceof Error
          ? error.message
          : ((error as { message?: string })?.message ?? "Failed to save office location")
      toast.error(msg)
    }
  }

  function openEditDialog(loc: OfficeLocation) {
    if (!canManageLocations) {
      toast.error("You can view office locations but cannot edit them")
      return
    }
    setEditingLocation(loc)
    setFormData({
      name: loc.name,
      type: loc.type,
      department: loc.department || "",
      description: loc.description || "",
      is_active: loc.is_active,
    })
    setIsDialogOpen(true)
  }

  function openCreateDialog() {
    if (!canManageLocations) {
      toast.error("You can view office locations but cannot create them")
      return
    }
    setEditingLocation(null)
    setFormData({ name: "", type: "office", department: "", description: "", is_active: true })
    setIsDialogOpen(true)
  }

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
      description="Manage office locations and the employees assigned to each location"
      icon={MapPin}
      backLinkHref="/admin/hr"
      backLinkLabel="Back to HR"
      actions={
        canManageLocations ? (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Location
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingLocation ? "Edit Office Location" : "Add Office Location"}</DialogTitle>
                  <DialogDescription>
                    {editingLocation
                      ? "Update the office location details below. Renaming will automatically update all assigned employee records."
                      : "Add a new office location to the system."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Location Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Technical Extension, MD Office"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="type">Location Type</Label>
                    <Select value={formData.type} onValueChange={(val) => setFormData({ ...formData, type: val })}>
                      <SelectTrigger id="type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {OFFICE_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="department">
                      Linked Department <span className="text-muted-foreground text-xs">(optional)</span>
                    </Label>
                    <Select
                      value={formData.department || "__none__"}
                      onValueChange={(val) => setFormData({ ...formData, department: val === "__none__" ? "" : val })}
                    >
                      <SelectTrigger id="department">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of this location..."
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="is_active">Active</Label>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">{editingLocation ? "Update" : "Create"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
        <StatCard title="Total Locations" value={locations.length} icon={MapPin} />
        <StatCard
          title="Active"
          value={locations.filter((l) => l.is_active).length}
          icon={MapPin}
          iconBgColor="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600 dark:text-green-400"
        />
        <StatCard
          title="Total Employees"
          value={locations.reduce((sum, l) => sum + (l.employee_count || 0), 0)}
          icon={Users}
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Office Locations</CardTitle>
          <CardDescription>Expand a location to see employees assigned there</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : locations.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No office locations yet"
              description="Create your first office location to get started."
              action={canManageLocations ? { label: "Add Location", onClick: openCreateDialog, icon: Plus } : undefined}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14"></TableHead>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Linked Dept</TableHead>
                  <TableHead>Employee Count</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((loc, index) => {
                  const isExpanded = expandedLocations.has(loc.id)
                  const members = locationEmployees[loc.name] || []

                  return (
                    <Fragment key={loc.id}>
                      <TableRow
                        className={cn(
                          "hover:bg-muted/30 cursor-pointer transition-colors",
                          isExpanded && "bg-muted/50"
                        )}
                        onClick={() => toggleLocationRow(loc.id)}
                      >
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleLocationRow(loc.id)
                            }}
                            className="h-7 w-7"
                            aria-label={isExpanded ? `Collapse ${loc.name}` : `Expand ${loc.name}`}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium">{loc.name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {loc.department ? (
                              <Badge variant="secondary">{loc.department}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{loc.employee_count || 0} employees</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate text-sm">
                          {loc.description || "No description added"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={loc.is_active ? "default" : "secondary"}>
                            {loc.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            {canManageLocations && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(loc)}
                                aria-label={`Edit location: ${loc.name}`}
                                title={`Edit location: ${loc.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow className="bg-muted/10 hover:bg-muted/10 border-t-0">
                          <TableCell colSpan={6} className="p-0">
                            <div className="animate-in slide-in-from-top-2 p-6 pt-2 duration-200">
                              {members.length === 0 ? (
                                <p className="text-muted-foreground px-1 py-1 text-sm">
                                  No employees assigned to this location.
                                </p>
                              ) : (
                                <div className="bg-background overflow-hidden rounded-lg border shadow-sm">
                                  <Table>
                                    <TableHeader className="bg-muted/30">
                                      <TableRow>
                                        <TableHead className="text-muted-foreground w-[70px] text-[10px] font-black tracking-widest uppercase">
                                          #
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
                                              {member.designation || "Employee"}
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
                              )}
                            </div>
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
