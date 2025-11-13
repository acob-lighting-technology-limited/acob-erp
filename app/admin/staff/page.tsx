"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { User } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatName } from "@/lib/utils"
import {
  Users,
  Search,
  Filter,
  Edit,
  Mail,
  Phone,
  Building2,
  MapPin,
  Shield,
  UserCog,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSignature,
  Download,
  FileText,
} from "lucide-react"
import type { UserRole } from "@/types/database"
import { getRoleDisplayName, getRoleBadgeColor, canAssignRoles, DEPARTMENTS } from "@/lib/permissions"
import { SignatureCreator } from "@/components/signature-creator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar, User as UserIcon } from "lucide-react"

interface Staff {
  id: string
  first_name: string
  last_name: string
  other_names: string | null
  company_email: string
  department: string
  company_role: string | null
  role: UserRole
  phone_number: string | null
  residential_address: string | null
  current_work_location: string | null
  is_admin: boolean
  is_department_lead: boolean
  lead_departments: string[]
  created_at: string
}

interface UserProfile {
  role: UserRole
}

export default function AdminStaffPage() {
  const searchParams = useSearchParams()
  const [staff, setStaff] = useState<Staff[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [staffFilter, setStaffFilter] = useState("all")
  const [roleFilter, setRoleFilter] = useState("all")
  const [nameSortOrder, setNameSortOrder] = useState<"asc" | "desc">("asc")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [viewStaffProfile, setViewStaffProfile] = useState<any>(null)
  const [viewStaffData, setViewStaffData] = useState<{
    tasks: any[]
    assets: any[]
    documentation: any[]
  }>({ tasks: [], assets: [], documentation: [] })

  // Form states
  const [editForm, setEditForm] = useState({
    role: "staff" as UserRole,
    department: "",
    company_role: "",
    lead_departments: [] as string[],
  })

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  // Handle userId from search params (for edit dialog)
  useEffect(() => {
    const userId = searchParams?.get("userId")
    if (userId && staff.length > 0 && !isEditDialogOpen) {
      const user = staff.find((s) => s.id === userId)
      if (user) {
        handleEditStaff(user)
      }
    }
  }, [searchParams, staff, isEditDialogOpen])

  const loadData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, lead_departments")
        .eq("id", user.id)
        .single()

      setUserProfile(profile)

      // Fetch staff - leads can only see staff in their departments
      let query = supabase.from("profiles").select("*").order("last_name", { ascending: true })

      // If user is a lead, filter by their lead departments
      if (profile?.role === "lead" && profile.lead_departments && profile.lead_departments.length > 0) {
        query = query.in("department", profile.lead_departments)
      }

      const { data, error } = await query

      if (error) throw error

      setStaff(data || [])
    } catch (error: any) {
      console.error("Error loading staff:", error)
      toast.error("Failed to load staff")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditStaff = (staffMember: Staff) => {
    setSelectedStaff(staffMember)
    setEditForm({
      role: staffMember.role,
      department: staffMember.department,
      company_role: staffMember.company_role || "",
      lead_departments: staffMember.lead_departments || [],
    })
    setIsEditDialogOpen(true)
  }

  const handleViewSignature = async (staffMember: Staff) => {
    try {
      setSelectedStaff(staffMember)
      setIsSignatureDialogOpen(true)

      // Load full profile data for signature
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", staffMember.id).single()

      if (profileData) {
        setSelectedStaff(profileData as any)
      }
    } catch (error: any) {
      console.error("Error loading profile for signature:", error)
      toast.error("Failed to load profile data")
    }
  }

  const handleViewDetails = async (staffMember: Staff) => {
    try {
      setSelectedStaff(staffMember)
      setIsViewDialogOpen(true)

      // Load full profile data
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", staffMember.id).single()

      if (profileData) {
        setViewStaffProfile(profileData)

        // Load related data
        const [tasksResult, assetsResult, docsResult] = await Promise.all([
          supabase
            .from("tasks")
            .select("*")
            .eq("assigned_to", staffMember.id)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("asset_assignments")
            .select(
              `
              *,
              Asset:assets(id, asset_name, asset_type, status)
            `
            )
            .eq("assigned_to", staffMember.id)
            .eq("is_current", true)
            .limit(10),
          supabase
            .from("user_documentation")
            .select("*")
            .eq("user_id", staffMember.id)
            .order("created_at", { ascending: false })
            .limit(10),
        ])

        setViewStaffData({
          tasks: tasksResult.data || [],
          assets: assetsResult.data || [],
          documentation: docsResult.data || [],
        })
      }
    } catch (error: any) {
      console.error("Error loading staff details:", error)
      toast.error("Failed to load staff details")
    }
  }

  const handleSaveStaff = async () => {
    if (isSaving) return // Prevent duplicate submissions
    setIsSaving(true)
    try {
      if (!selectedStaff) {
        setIsSaving(false)
        return
      }

      // Check if user can assign this role
      if (userProfile && !canAssignRoles(userProfile.role, editForm.role)) {
        toast.error("You don't have permission to assign this role")
        setIsSaving(false)
        return
      }

      // Validate: If role is lead, at least one department must be selected
      if (editForm.role === "lead" && editForm.lead_departments.length === 0) {
        toast.error("Please select at least one department for this lead")
        setIsSaving(false)
        return
      }

      // If role is lead, automatically set is_department_lead to true
      const isLead = editForm.role === "lead"

      const { error } = await supabase
        .from("profiles")
        .update({
          role: editForm.role,
          department: editForm.department,
          company_role: editForm.company_role || null,
          is_department_lead: isLead,
          lead_departments: isLead ? editForm.lead_departments : [],
          is_admin: ["super_admin", "admin"].includes(editForm.role),
        })
        .eq("id", selectedStaff.id)

      if (error) throw error

      toast.success("Staff member updated successfully")
      setIsEditDialogOpen(false)
      loadData()
    } catch (error: any) {
      console.error("Error updating staff:", error)
      toast.error("Failed to update staff member")
    } finally {
      setIsSaving(false)
    }
  }

  const filteredStaff = staff
    .filter((member) => {
      const matchesSearch =
        member.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.company_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.company_role?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesDepartment = departmentFilter === "all" || member.department === departmentFilter

      const matchesStaff = staffFilter === "all" || member.id === staffFilter

      const matchesRole = roleFilter === "all" || member.role === roleFilter

      return matchesSearch && matchesDepartment && matchesStaff && matchesRole
    })
    .sort((a, b) => {
      const lastNameA = formatName(a.last_name).toLowerCase()
      const lastNameB = formatName(b.last_name).toLowerCase()

      if (nameSortOrder === "asc") {
        return lastNameA.localeCompare(lastNameB)
      } else {
        return lastNameB.localeCompare(lastNameA)
      }
    })

  const departments = Array.from(new Set(staff.map((s) => s.department).filter(Boolean))) as string[]

  const roles: UserRole[] = ["visitor", "staff", "lead", "admin", "super_admin"]

  const stats = {
    total: staff.length,
    admins: staff.filter((s) => ["super_admin", "admin"].includes(s.role)).length,
    leads: staff.filter((s) => s.role === "lead").length,
    staff: staff.filter((s) => s.role === "staff").length,
  }

  const exportStaffToExcel = async () => {
    try {
      if (filteredStaff.length === 0) {
        toast.error("No staff data to export")
        return
      }

      const XLSX = await import("xlsx")
      const { default: saveAs } = await import("file-saver")

      const dataToExport = filteredStaff.map((member, index) => ({
        "#": index + 1,
        Name: `${formatName(member.first_name)} ${formatName(member.last_name)}`,
        Email: member.company_email,
        Department: member.department || "-",
        Role: getRoleDisplayName(member.role),
        Position: member.company_role || "-",
        Phone: member.phone_number || "-",
        "Work Location": member.current_work_location || "-",
        "Is Lead": member.is_department_lead ? "Yes" : "No",
        "Lead Departments": member.lead_departments?.length ? member.lead_departments.join(", ") : "-",
        "Created At": member.created_at ? new Date(member.created_at).toLocaleDateString() : "-",
      }))

      const ws = XLSX.utils.json_to_sheet(dataToExport)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Staff")

      const maxWidth = 60
      const cols = Object.keys(dataToExport[0] || {}).map((key) => ({
        wch: Math.min(
          Math.max(key.length, ...dataToExport.map((row) => String(row[key as keyof typeof row]).length)),
          maxWidth
        ),
      }))
      ws["!cols"] = cols

      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      const data = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      saveAs(data, `staff-export-${new Date().toISOString().split("T")[0]}.xlsx`)
      toast.success("Staff exported to Excel successfully")
    } catch (error: any) {
      console.error("Error exporting staff to Excel:", error)
      toast.error("Failed to export staff to Excel")
    }
  }

  const exportStaffToPDF = async () => {
    try {
      if (filteredStaff.length === 0) {
        toast.error("No staff data to export")
        return
      }

      const jsPDF = (await import("jspdf")).default
      const autoTable = (await import("jspdf-autotable")).default

      const doc = new jsPDF({ orientation: "landscape" })
      doc.setFontSize(16)
      doc.text("Staff Report", 14, 15)
      doc.setFontSize(10)
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22)
      doc.text(`Total Staff: ${filteredStaff.length}`, 14, 28)

      const dataToExport = filteredStaff.map((member, index) => [
        index + 1,
        `${formatName(member.first_name)} ${formatName(member.last_name)}`,
        member.company_email,
        member.department || "-",
        getRoleDisplayName(member.role),
        member.company_role || "-",
        member.phone_number || "-",
        member.is_department_lead
          ? member.lead_departments?.length
            ? member.lead_departments.join(", ")
            : "Yes"
          : "-",
      ])

      autoTable(doc, {
        head: [["#", "Name", "Email", "Department", "Role", "Position", "Phone", "Lead Departments"]],
        body: dataToExport,
        startY: 35,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      })

      doc.save(`staff-export-${new Date().toISOString().split("T")[0]}.pdf`)
      toast.success("Staff exported to PDF successfully")
    } catch (error: any) {
      console.error("Error exporting staff to PDF:", error)
      toast.error("Failed to export staff to PDF")
    }
  }

  const exportStaffToWord = async () => {
    try {
      if (filteredStaff.length === 0) {
        toast.error("No staff data to export")
        return
      }

      const {
        Document,
        Packer,
        Paragraph,
        Table,
        TableCell,
        TableRow,
        WidthType,
        AlignmentType,
        HeadingLevel,
        TextRun,
      } = await import("docx")
      const { default: saveAs } = await import("file-saver")

      const tableRows = [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "#", bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Name", bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Email", bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Department", bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Role", bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Position", bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Phone", bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Work Location", bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Is Lead", bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Lead Departments", bold: true })],
                }),
              ],
            }),
          ],
        }),
        ...filteredStaff.map(
          (member, index) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph((index + 1).toString())],
                }),
                new TableCell({
                  children: [new Paragraph(`${formatName(member.first_name)} ${formatName(member.last_name)}`)],
                }),
                new TableCell({
                  children: [new Paragraph(member.company_email)],
                }),
                new TableCell({
                  children: [new Paragraph(member.department || "-")],
                }),
                new TableCell({
                  children: [new Paragraph(getRoleDisplayName(member.role))],
                }),
                new TableCell({
                  children: [new Paragraph(member.company_role || "-")],
                }),
                new TableCell({
                  children: [new Paragraph(member.phone_number || "-")],
                }),
                new TableCell({
                  children: [new Paragraph(member.current_work_location || "-")],
                }),
                new TableCell({
                  children: [new Paragraph(member.is_department_lead ? "Yes" : "No")],
                }),
                new TableCell({
                  children: [new Paragraph(member.lead_departments?.length ? member.lead_departments.join(", ") : "-")],
                }),
              ],
            })
        ),
      ]

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                text: "Staff Report",
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                text: `Generated on: ${new Date().toLocaleDateString()}`,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                text: `Total Staff: ${filteredStaff.length}`,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({ text: "" }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: tableRows,
              }),
            ],
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      saveAs(blob, `staff-export-${new Date().toISOString().split("T")[0]}.docx`)
      toast.success("Staff exported to Word successfully")
    } catch (error: any) {
      console.error("Error exporting staff to Word:", error)
      toast.error("Failed to export staff to Word")
    }
  }

  const getAvailableRoles = (): UserRole[] => {
    if (!userProfile) return []

    if (userProfile.role === "super_admin") {
      return ["visitor", "staff", "lead", "admin", "super_admin"]
    } else if (userProfile.role === "admin") {
      return ["visitor", "staff", "lead"]
    }

    return []
  }

  return (
    <div className="from-background via-background to-muted/20 min-h-screen w-full overflow-x-hidden bg-gradient-to-br">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold sm:gap-3 sm:text-3xl">
              <Users className="text-primary h-6 w-6 sm:h-8 sm:w-8" />
              Staff Management
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              View and manage staff members, roles, and permissions
            </p>
          </div>
          <div className="flex items-center rounded-lg border p-1">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="gap-1 sm:gap-2"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              variant={viewMode === "card" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("card")}
              className="gap-1 sm:gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Card</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-4 md:gap-4">
          <Card className="border-2">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Total Staff</p>
                  <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">{stats.total}</p>
                </div>
                <div className="ml-1 shrink-0 rounded-lg bg-blue-100 p-1.5 sm:p-2 md:p-3 dark:bg-blue-900/30">
                  <Users className="h-4 w-4 text-blue-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Admins</p>
                  <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">
                    {stats.admins}
                  </p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-red-100 p-1.5 sm:p-2 md:p-3 dark:bg-red-900/30">
                  <Shield className="h-4 w-4 text-red-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Leads</p>
                  <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">{stats.leads}</p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-purple-100 p-1.5 sm:p-2 md:p-3 dark:bg-purple-900/30">
                  <UserCog className="h-4 w-4 text-purple-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Staff Members</p>
                  <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">{stats.staff}</p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-green-100 p-1.5 sm:p-2 md:p-3 dark:bg-green-900/30">
                  <Users className="h-4 w-4 text-green-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Export Buttons */}
        <Card className="border-2">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Download className="text-muted-foreground h-4 w-4" />
                <span className="text-foreground text-sm font-medium">Export Filtered Staff:</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportStaffToExcel}
                  className="gap-2"
                  disabled={filteredStaff.length === 0}
                >
                  <FileText className="h-4 w-4" />
                  Excel (.xlsx)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportStaffToPDF}
                  className="gap-2"
                  disabled={filteredStaff.length === 0}
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportStaffToWord}
                  className="gap-2"
                  disabled={filteredStaff.length === 0}
                >
                  <FileText className="h-4 w-4" />
                  Word (.docx)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                <Input
                  placeholder="Search staff..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <SearchableSelect
                value={departmentFilter}
                onValueChange={setDepartmentFilter}
                placeholder="All Departments"
                searchPlaceholder="Search departments..."
                icon={<Building2 className="h-4 w-4" />}
                className="w-full md:w-48"
                options={[
                  { value: "all", label: "All Departments" },
                  ...departments.map((dept) => ({
                    value: dept,
                    label: dept,
                    icon: <Building2 className="h-3 w-3" />,
                  })),
                ]}
              />
              <SearchableSelect
                value={staffFilter}
                onValueChange={setStaffFilter}
                placeholder="All Staff"
                searchPlaceholder="Search staff..."
                icon={<User className="h-4 w-4" />}
                className="w-full md:w-48"
                options={[
                  { value: "all", label: "All Staff" },
                  ...staff.map((member) => ({
                    value: member.id,
                    label: `${formatName(member.first_name)} ${formatName(
                      member.last_name
                    )} - ${member.department || "No Dept"}`,
                    icon: <User className="h-3 w-3" />,
                  })),
                ]}
              />
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {getRoleDisplayName(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Staff List */}
        {filteredStaff.length > 0 ? (
          viewMode === "list" ? (
            <Card className="border-2">
              <div className="table-responsive">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <span>Name</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setNameSortOrder(nameSortOrder === "asc" ? "desc" : "asc")}
                            className="h-6 w-6 p-0"
                          >
                            {nameSortOrder === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map((member, index) => (
                      <TableRow key={member.id}>
                        <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/staff/${member.id}`}
                            className="hover:text-primary flex items-center gap-2 transition-colors"
                          >
                            <div className="bg-primary/10 rounded-lg p-2">
                              <Users className="text-primary h-4 w-4" />
                            </div>
                            <span className="text-foreground font-medium">
                              {formatName(member.last_name)}, {formatName(member.first_name)}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="text-muted-foreground flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3" />
                            <span className="max-w-[200px] truncate">{member.company_email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-foreground text-sm">{member.department || "-"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge className={getRoleBadgeColor(member.role)}>{getRoleDisplayName(member.role)}</Badge>
                            {member.role === "lead" &&
                              member.lead_departments &&
                              member.lead_departments.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {member.lead_departments.length} Dept
                                  {member.lead_departments.length > 1 ? "s" : ""}
                                </Badge>
                              )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground text-sm">{member.company_role || "-"}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 sm:gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 sm:h-auto sm:w-auto sm:p-2"
                              title="View Signature"
                              onClick={() => handleViewSignature(member)}
                            >
                              <FileSignature className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs sm:h-auto sm:text-sm"
                              onClick={() => handleViewDetails(member)}
                            >
                              <span className="hidden sm:inline">View</span>
                              <span className="sm:hidden">👁</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 sm:h-auto sm:w-auto sm:p-2"
                              onClick={() => handleEditStaff(member)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredStaff.map((member) => (
                <Card key={member.id} className="border-2 transition-shadow hover:shadow-lg">
                  <CardHeader className="from-primary/5 to-background border-b bg-linear-to-r">
                    <div className="flex items-start justify-between">
                      <Link
                        href={`/admin/staff/${member.id}`}
                        className="hover:text-primary flex flex-1 items-start gap-3 transition-colors"
                      >
                        <div className="bg-primary/10 rounded-lg p-2">
                          <Users className="text-primary h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-lg">
                            {member.first_name} {member.last_name}
                          </CardTitle>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge className={getRoleBadgeColor(member.role)}>{getRoleDisplayName(member.role)}</Badge>
                            {member.role === "lead" &&
                              member.lead_departments &&
                              member.lead_departments.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {member.lead_departments.length} Dept
                                  {member.lead_departments.length > 1 ? "s" : ""}
                                </Badge>
                              )}
                          </div>
                        </div>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditStaff(member)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{member.company_email}</span>
                    </div>

                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4" />
                      <span>{member.department || "-"}</span>
                    </div>

                    {member.company_role && (
                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <UserCog className="h-4 w-4" />
                        <span>{member.company_role}</span>
                      </div>
                    )}

                    {member.phone_number && (
                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4" />
                        <span>{member.phone_number}</span>
                      </div>
                    )}

                    {member.current_work_location && (
                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4" />
                        <span>{member.current_work_location}</span>
                      </div>
                    )}

                    {member.is_department_lead && member.lead_departments.length > 0 && (
                      <div className="border-t pt-2">
                        <p className="text-muted-foreground mb-1 text-xs">Leading:</p>
                        <div className="flex flex-wrap gap-1">
                          {member.lead_departments.map((dept, idx) => (
                            <span
                              key={idx}
                              className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            >
                              {dept}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewDetails(member)} className="flex-1">
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewSignature(member)}
                        className="flex-1"
                        title="View Signature"
                      >
                        <FileSignature className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditStaff(member)}
                        className="flex-1 gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          <Card className="border-2">
            <CardContent className="p-12 text-center">
              <Users className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
              <h3 className="text-foreground mb-2 text-xl font-semibold">No Staff Found</h3>
              <p className="text-muted-foreground">
                {searchQuery || departmentFilter !== "all" || roleFilter !== "all"
                  ? "No staff matches your filters"
                  : "No staff members found"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Staff Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Edit {selectedStaff?.first_name} {selectedStaff?.last_name}
            </DialogTitle>
            <DialogDescription>Update staff member's role, department, and permissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="role">Role *</Label>
              <Select
                value={editForm.role}
                onValueChange={(value: UserRole) => {
                  setEditForm({ ...editForm, role: value })
                  // Clear lead departments when role is not lead
                  if (value !== "lead") {
                    setEditForm((prev) => ({
                      ...prev,
                      role: value,
                      lead_departments: [],
                    }))
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableRoles().map((role) => (
                    <SelectItem key={role} value={role}>
                      {getRoleDisplayName(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground mt-1 text-xs">
                {userProfile?.role === "admin"
                  ? "As Admin, you can assign: Visitor, Staff, and Lead roles"
                  : "As Super Admin, you can assign any role"}
              </p>
              {editForm.role === "lead" && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Lead role requires selecting at least one department below
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="department">Department *</Label>
              <Select
                value={editForm.department}
                onValueChange={(value) => setEditForm({ ...editForm, department: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="company_role">Position/Title</Label>
              <Input
                id="company_role"
                value={editForm.company_role}
                onChange={(e) => setEditForm({ ...editForm, company_role: e.target.value })}
                placeholder="e.g., Senior Developer"
              />
            </div>

            {editForm.role === "lead" && (
              <div className="space-y-2">
                <div className="bg-primary/10 border-primary/20 rounded-lg border p-3">
                  <p className="text-primary mb-2 text-sm font-medium">Lead Department Selection Required</p>
                  <p className="text-muted-foreground text-xs">
                    Select at least one department that this person will lead
                  </p>
                </div>

                <div>
                  <Label>Lead Departments *</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {DEPARTMENTS.map((dept) => (
                      <div key={dept} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`dept-${dept}`}
                          checked={editForm.lead_departments.includes(dept)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditForm({
                                ...editForm,
                                lead_departments: [...editForm.lead_departments, dept],
                              })
                            } else {
                              setEditForm({
                                ...editForm,
                                lead_departments: editForm.lead_departments.filter((d) => d !== dept),
                              })
                            }
                          }}
                          className="rounded"
                        />
                        <Label htmlFor={`dept-${dept}`} className="text-sm">
                          {dept}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {editForm.lead_departments.length === 0 && (
                    <p className="text-destructive mt-2 text-xs">Please select at least one department</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveStaff} loading={isSaving}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature Dialog */}
      <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Email Signature - {selectedStaff?.first_name} {selectedStaff?.last_name}
            </DialogTitle>
            <DialogDescription>View and manage signature for this staff member</DialogDescription>
          </DialogHeader>
          {selectedStaff && (
            <div className="mt-4">
              <SignatureCreator profile={selectedStaff} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {viewStaffProfile
                ? `${formatName(viewStaffProfile.first_name)} ${formatName(viewStaffProfile.last_name)}`
                : "Staff Details"}
            </DialogTitle>
            <DialogDescription>View complete profile and related information</DialogDescription>
          </DialogHeader>
          {viewStaffProfile && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4">
                {/* Profile Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserIcon className="h-5 w-5" />
                      Profile Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {formatName(viewStaffProfile.first_name)?.[0]}
                            {formatName(viewStaffProfile.last_name)?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-muted-foreground text-sm">Full Name</p>
                          <p className="font-medium">
                            {formatName(viewStaffProfile.first_name)} {formatName(viewStaffProfile.last_name)}
                          </p>
                          {viewStaffProfile.other_names && (
                            <p className="text-muted-foreground text-xs">({viewStaffProfile.other_names})</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Mail className="text-muted-foreground h-5 w-5" />
                        <div>
                          <p className="text-muted-foreground text-sm">Email</p>
                          <p className="font-medium">{viewStaffProfile.company_email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Building2 className="text-muted-foreground h-5 w-5" />
                        <div>
                          <p className="text-muted-foreground text-sm">Department</p>
                          <p className="font-medium">{viewStaffProfile.department || "N/A"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Shield className="text-muted-foreground h-5 w-5" />
                        <div>
                          <p className="text-muted-foreground text-sm">Role</p>
                          <div className="mt-1 flex gap-2">
                            <Badge className={getRoleBadgeColor(viewStaffProfile.role as UserRole)}>
                              {getRoleDisplayName(viewStaffProfile.role as UserRole)}
                            </Badge>
                            {viewStaffProfile.role === "lead" &&
                              viewStaffProfile.lead_departments &&
                              viewStaffProfile.lead_departments.length > 0 && (
                                <Badge variant="outline">
                                  Leading {viewStaffProfile.lead_departments.length} Dept
                                  {viewStaffProfile.lead_departments.length > 1 ? "s" : ""}
                                </Badge>
                              )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <UserIcon className="text-muted-foreground h-5 w-5" />
                        <div>
                          <p className="text-muted-foreground text-sm">Position</p>
                          <p className="font-medium">{viewStaffProfile.company_role || "N/A"}</p>
                        </div>
                      </div>

                      {viewStaffProfile.phone_number && (
                        <div className="flex items-center gap-3">
                          <Phone className="text-muted-foreground h-5 w-5" />
                          <div>
                            <p className="text-muted-foreground text-sm">Phone</p>
                            <p className="font-medium">{viewStaffProfile.phone_number}</p>
                            {viewStaffProfile.additional_phone && (
                              <p className="text-muted-foreground text-xs">{viewStaffProfile.additional_phone}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {viewStaffProfile.residential_address && (
                        <div className="flex items-center gap-3">
                          <MapPin className="text-muted-foreground h-5 w-5" />
                          <div>
                            <p className="text-muted-foreground text-sm">Address</p>
                            <p className="font-medium">{viewStaffProfile.residential_address}</p>
                          </div>
                        </div>
                      )}

                      {viewStaffProfile.current_work_location && (
                        <div className="flex items-center gap-3">
                          <MapPin className="text-muted-foreground h-5 w-5" />
                          <div>
                            <p className="text-muted-foreground text-sm">Work Location</p>
                            <p className="font-medium">{viewStaffProfile.current_work_location}</p>
                          </div>
                        </div>
                      )}

                      {viewStaffProfile.lead_departments && viewStaffProfile.lead_departments.length > 0 && (
                        <div className="flex items-center gap-3">
                          <Building2 className="text-muted-foreground h-5 w-5" />
                          <div>
                            <p className="text-muted-foreground text-sm">Leading Departments</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {viewStaffProfile.lead_departments.map((dept: string) => (
                                <Badge key={dept} variant="outline">
                                  {dept}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <Calendar className="text-muted-foreground h-5 w-5" />
                        <div>
                          <p className="text-muted-foreground text-sm">Member Since</p>
                          <p className="font-medium">{new Date(viewStaffProfile.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Related Data Tabs */}
                <Tabs defaultValue="tasks" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="tasks">Tasks ({viewStaffData.tasks.length})</TabsTrigger>
                    <TabsTrigger value="assets">Assets ({viewStaffData.assets.length})</TabsTrigger>
                    <TabsTrigger value="documentation">
                      Documentation ({viewStaffData.documentation.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="tasks">
                    <Card>
                      <CardHeader>
                        <CardTitle>Assigned Tasks</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {viewStaffData.tasks.length > 0 ? (
                          <div className="space-y-2">
                            {viewStaffData.tasks.map((task: any) => (
                              <div key={task.id} className="rounded-lg border p-3">
                                <p className="font-medium">{task.title}</p>
                                <p className="text-muted-foreground text-sm">{task.status}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No tasks assigned</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="assets">
                    <Card>
                      <CardHeader>
                        <CardTitle>Assigned Assets</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {viewStaffData.assets.length > 0 ? (
                          <div className="space-y-2">
                            {viewStaffData.assets.map((assignment: any) => (
                              <div key={assignment.id} className="rounded-lg border p-3">
                                <p className="font-medium">{assignment.Asset?.asset_name || "N/A"}</p>
                                <p className="text-muted-foreground text-sm">{assignment.Asset?.asset_type || "N/A"}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No assets assigned</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="documentation">
                    <Card>
                      <CardHeader>
                        <CardTitle>Documentation</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {viewStaffData.documentation.length > 0 ? (
                          <div className="space-y-2">
                            {viewStaffData.documentation.map((doc: any) => (
                              <div key={doc.id} className="rounded-lg border p-3">
                                <p className="font-medium">{doc.title || "Untitled"}</p>
                                <p className="text-muted-foreground text-sm">
                                  {new Date(doc.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No documentation</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
