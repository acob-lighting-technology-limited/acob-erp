"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Copy, Download, Edit2, Eye, Upload } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { AdminUserModal } from "./admin-user-modal"
import { formatName } from "@/lib/utils"

const DEPARTMENTS = [
  "All Departments",
  "Accounts",
  "Admin & HR",
  "Business, Growth and Innovation",
  "IT and Communications",
  "Legal, Regulatory and Compliance",
  "Logistics",
  "Operations",
  "Technical",
]

const DEVICE_TYPES = ["All Devices", "None", "Laptop", "Desktop"]
const DEVICE_BRANDS = ["All Brands", "Dell", "HP", "Others"]

interface AdminDashboardProps {
  users: any[]
  currentUserId: string
  feedbackByUserId?: Record<string, any[]>
}

export function AdminDashboard({ users, currentUserId, feedbackByUserId = {} }: AdminDashboardProps) {
  const [filteredUsers, setFilteredUsers] = useState(users)
  const [selectedDepartment, setSelectedDepartment] = useState("All Departments")
  const [selectedDeviceType, setSelectedDeviceType] = useState("All Devices")
  const [selectedDeviceBrand, setSelectedDeviceBrand] = useState("All Brands")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const [sortKey, setSortKey] = useState<
    "last_name" | "first_name" | "company_email" | "department" | "device_type" | "device_allocated" | null
  >(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const properCase = (s: string | null | undefined): string => {
    if (!s) return ""
    return s
      .toString()
      .toLowerCase()
      .replace(/\b([a-z])/g, (m) => m.toUpperCase())
  }

  const cleanPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return "-"
    // Remove all non-numeric characters except +
    return phone.toString().replace(/[^0-9+]/g, "") || "-"
  }

  const applySort = (list: any[]) => {
    if (!sortKey) return list
    const sorted = [...list].sort((a, b) => {
      const av = (a[sortKey] || "").toString().toLowerCase()
      const bv = (b[sortKey] || "").toString().toLowerCase()
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })
    return sorted
  }

  const setSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  // Real-time filtering with useEffect
  useEffect(() => {
    let filtered = users

    if (selectedDepartment !== "All Departments") {
      filtered = filtered.filter((user) => user.department === selectedDepartment)
    }

    if (selectedDeviceType !== "All Devices") {
      if (selectedDeviceType === "None") {
        filtered = filtered.filter((user) => !user.device_type)
      } else {
        filtered = filtered.filter((user) => user.device_type === selectedDeviceType)
      }
    }

    if (selectedDeviceBrand !== "All Brands") {
      if (selectedDeviceBrand === "Others") {
        filtered = filtered.filter(
          (user) =>
            user.device_allocated && !user.device_allocated.includes("Dell") && !user.device_allocated.includes("HP")
        )
      } else {
        filtered = filtered.filter((user) => user.device_allocated?.includes(selectedDeviceBrand))
      }
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.company_email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    filtered = applySort(filtered)
    setFilteredUsers(filtered)
  }, [users, selectedDepartment, selectedDeviceType, selectedDeviceBrand, searchTerm, sortKey, sortDir])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  }

  const exportToCSV = () => {
    const headers = [
      "First Name",
      "Last Name",
      "Department",
      "Company Role",
      "Email",
      "Phone",
      "Device Type",
      "Device Model",
      "Work Location",
    ]
    const rows = filteredUsers.map((user) => [
      user.first_name,
      user.last_name,
      user.department,
      user.company_role,
      user.company_email,
      user.phone_number,
      user.device_type,
      user.device_allocated,
      user.current_work_location,
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell || ""}"`).join(",")).join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `staff-data-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    toast.success("CSV exported successfully!")
  }

  const exportToJSON = () => {
    const json = JSON.stringify(filteredUsers, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `staff-data-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    toast.success("JSON exported successfully!")
  }

  const exportToXLSX = async () => {
    try {
      const { utils, writeFile } = await import("xlsx")
      const worksheet = utils.json_to_sheet(
        filteredUsers.map((user) => ({
          "First Name": user.first_name,
          "Last Name": user.last_name,
          Department: user.department,
          "Company Role": user.company_role,
          Email: user.company_email,
          Phone: user.phone_number,
          "Device Type": user.device_type,
          "Device Model": user.device_allocated,
          "Work Location": user.current_work_location,
        }))
      )
      const workbook = utils.book_new()
      utils.book_append_sheet(workbook, worksheet, "Staff")
      writeFile(workbook, `staff-data-${new Date().toISOString().split("T")[0]}.xlsx`)
      toast.success("XLSX exported successfully!")
    } catch (error) {
      toast.error("Failed to export XLSX")
    }
  }

  const exportToPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf")
      const { autoTable } = await import("jspdf-autotable")

      const doc = new jsPDF()
      const tableData = filteredUsers.map((user) => [
        user.first_name,
        user.last_name,
        user.department,
        user.company_role,
        user.company_email,
        user.phone_number,
        user.device_type,
      ])

      autoTable(doc, {
        head: [["First Name", "Last Name", "Department", "Role", "Email", "Phone", "Device"]],
        body: tableData,
      })

      doc.save(`staff-data-${new Date().toISOString().split("T")[0]}.pdf`)
      toast.success("PDF exported successfully!")
    } catch (error) {
      toast.error("Failed to export PDF")
    }
  }

  const handleImportCSV = async () => {
    if (!confirm("This will import staff data from CSV. Continue?")) {
      return
    }

    setIsImporting(true)
    toast.loading("Importing staff data...", { id: "import" })

    try {
      const response = await fetch("/api/admin/import-csv", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Import failed")
      }

      toast.success(
        `Import complete! Imported: ${data.imported}, Skipped: ${data.skipped}, Errors: ${data.errorCount}`,
        { id: "import" }
      )

      // Refresh the page after a short delay to show updated data
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed"
      toast.error(message, { id: "import" })
    } finally {
      setIsImporting(false)
    }
  }

  const getLatestFeedbackType = (userId: string): string | null => {
    const list = feedbackByUserId[userId] || []
    return list.length > 0 ? list[0].feedback_type : null
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "concern":
        return "bg-yellow-500"
      case "complaint":
        return "bg-red-500"
      case "suggestion":
        return "bg-blue-500"
      case "required_item":
        return "bg-purple-500"
      default:
        return "bg-gray-300"
    }
  }

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsUser, setDetailsUser] = useState<any | null>(null)

  const openDetails = (user: any) => {
    setDetailsUser(user)
    setDetailsOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Import/Export Options (moved above Filters) */}
      <Card>
        <CardHeader>
          <CardTitle>Import & Export Data</CardTitle>
          <CardDescription>Import staff from CSV or download data in various formats</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleImportCSV} variant="default" size="sm" disabled={isImporting} className="bg-primary">
              <Upload className="mr-2 h-4 w-4" />
              {isImporting ? "Importing..." : "Import CSV"}
            </Button>
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={exportToJSON} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
            <Button onClick={exportToXLSX} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export XLSX
            </Button>
            <Button onClick={exportToPDF} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Link href="/admin/feedback">
              <Button variant="outline" size="sm">
                View Feedback
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
          <CardDescription>Filter users by department, device type, or search by name/email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger id="department">
                  <SelectValue />
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
            <div className="space-y-2">
              <Label htmlFor="deviceType">Device Type</Label>
              <Select value={selectedDeviceType} onValueChange={setSelectedDeviceType}>
                <SelectTrigger id="deviceType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deviceBrand">Device Brand</Label>
              <Select value={selectedDeviceBrand} onValueChange={setSelectedDeviceBrand}>
                <SelectTrigger id="deviceBrand">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_BRANDS.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSelectedDepartment("All Departments")
                  setSelectedDeviceType("All Devices")
                  setSelectedDeviceBrand("All Brands")
                  setSearchTerm("")
                  setSortKey(null)
                  setSortDir("asc")
                  setFilteredUsers(applySort(users))
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Import/Export Options */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Import & Export Data</CardTitle>
          <CardDescription>Import staff from CSV or download data in various formats</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleImportCSV}
              variant="default"
              size="sm"
              disabled={isImporting}
              className="bg-primary"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isImporting ? "Importing..." : "Import CSV"}
            </Button>
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={exportToJSON} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
            <Button onClick={exportToXLSX} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export XLSX
            </Button>
            <Button onClick={exportToPDF} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Link href="/admin/feedback">
              <Button variant="outline" size="sm">
                View Feedback
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card> */}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Members</CardTitle>
          <CardDescription>Total: {filteredUsers.length} users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>S/N</TableHead>
                  <TableHead>
                    <button onClick={() => setSort("last_name")} className="underline-offset-2 hover:underline">
                      Last Name {sortKey === "last_name" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => setSort("first_name")} className="underline-offset-2 hover:underline">
                      First Name {sortKey === "first_name" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => setSort("company_email")} className="underline-offset-2 hover:underline">
                      Email {sortKey === "company_email" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => setSort("department")} className="underline-offset-2 hover:underline">
                      Department {sortKey === "department" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </button>
                  </TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>
                    <button onClick={() => setSort("device_type")} className="underline-offset-2 hover:underline">
                      Device Type {sortKey === "device_type" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => setSort("device_allocated")} className="underline-offset-2 hover:underline">
                      Device Brand {sortKey === "device_allocated" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </button>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user, index) => (
                  <TableRow key={user.id} className="cursor-pointer" onClick={() => openDetails(user)}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{properCase(user.last_name)}</TableCell>
                    <TableCell>{properCase(user.first_name)}</TableCell>
                    <TableCell>
                      <button
                        className="underline-offset-2 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText((user.company_email || "").toLowerCase())
                          toast.success("Email copied")
                        }}
                      >
                        {(user.company_email || "").toLowerCase()}
                      </button>
                    </TableCell>
                    <TableCell>{user.department ? properCase(user.department) : "-"}</TableCell>
                    <TableCell>{cleanPhoneNumber(user.phone_number)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{properCase(user.device_type) || "-"}</span>
                        {getLatestFeedbackType(user.id) && (
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${getTypeColor(getLatestFeedbackType(user.id)!)}`}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{properCase(user.device_allocated) || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user)
                            setShowModal(true)
                          }}
                          aria-label="Edit user"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(
                              `${properCase(user.first_name)} ${properCase(user.last_name)} - ${(user.company_email || "").toLowerCase()}`,
                              "User details"
                            )
                          }
                          aria-label="Copy user"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Link href={`/signature?userId=${user.id}`} onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" aria-label="View signature">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Details Modal */}
      {detailsUser && (
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Staff Details</DialogTitle>
              <DialogDescription>Full profile and recent feedback</DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Profile card */}
              <div className="rounded-lg border p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>First Name</Label>
                    <div className="mt-1 font-medium">{formatName(detailsUser.first_name)}</div>
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <div className="mt-1 font-medium">{formatName(detailsUser.last_name)}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Email</Label>
                    <div className="mt-1 font-medium break-all">{(detailsUser.company_email || "").toLowerCase()}</div>
                  </div>
                  <div>
                    <Label>Department</Label>
                    <div className="mt-1">{properCase(detailsUser.department)}</div>
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <div className="mt-1">{detailsUser.phone_number}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Device</Label>
                    <div className="mt-1">
                      {properCase(detailsUser.device_type)} {properCase(detailsUser.device_model)}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Address</Label>
                    <div className="mt-1">{properCase(detailsUser.residential_address)}</div>
                  </div>
                  <div>
                    <Label>Work Location</Label>
                    <div className="mt-1">{properCase(detailsUser.current_work_location)}</div>
                  </div>
                  <div>
                    <Label>Bank</Label>
                    <div className="mt-1">
                      {properCase(detailsUser.bank_name)} {detailsUser.bank_account_number}
                    </div>
                  </div>
                  <div>
                    <Label>Account Name</Label>
                    <div className="mt-1">{properCase(detailsUser.bank_account_name)}</div>
                  </div>
                  <div>
                    <Label>DOB</Label>
                    <div className="mt-1">{detailsUser.date_of_birth || ""}</div>
                  </div>
                  <div>
                    <Label>Employment Date</Label>
                    <div className="mt-1">{detailsUser.employment_date || ""}</div>
                  </div>
                </div>
              </div>

              {/* Feedback card */}
              <div className="rounded-lg border p-4">
                <div className="mb-2 font-semibold">Recent Feedback</div>
                <div className="space-y-2">
                  {(feedbackByUserId[detailsUser.id] || []).slice(0, 5).map((fb) => (
                    <div key={fb.id} className="rounded-md border p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 rounded-full ${getTypeColor(fb.feedback_type)}`} />
                        <span className="font-medium">{fb.feedback_type}</span>
                        <span className="text-muted-foreground ml-auto text-xs">
                          {new Date(fb.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 font-medium">{fb.title}</div>
                      <div className="text-muted-foreground">{fb.description}</div>
                    </div>
                  ))}
                  {(!feedbackByUserId[detailsUser.id] || feedbackByUserId[detailsUser.id].length === 0) && (
                    <div className="text-muted-foreground text-sm">No feedback yet</div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const lines = [
                      `Name: ${properCase(detailsUser.first_name)} ${properCase(detailsUser.last_name)}`,
                      `Email: ${(detailsUser.company_email || "").toLowerCase()}`,
                      `Department: ${properCase(detailsUser.department)}`,
                      `Phone: ${detailsUser.phone_number || ""}`,
                      `Device: ${properCase(detailsUser.device_type)} ${properCase(detailsUser.device_model)}`,
                      `Address: ${properCase(detailsUser.residential_address)}`,
                      `Work Location: ${properCase(detailsUser.current_work_location)}`,
                      `Bank: ${properCase(detailsUser.bank_name)} ${detailsUser.bank_account_number || ""}`,
                      `Account Name: ${properCase(detailsUser.bank_account_name)}`,
                      `DOB: ${detailsUser.date_of_birth || ""}`,
                      `Employment: ${detailsUser.employment_date || ""}`,
                    ]
                    navigator.clipboard.writeText(lines.join("\n"))
                    toast.success("Copied full data")
                  }}
                >
                  Copy Full Data
                </Button>
                <Button onClick={() => setDetailsOpen(false)}>Close</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Modal */}
      {showModal && selectedUser && (
        <AdminUserModal
          user={selectedUser}
          onClose={() => {
            setShowModal(false)
            setSelectedUser(null)
          }}
          onSave={() => {
            setShowModal(false)
            setSelectedUser(null)
            toast.success("User updated successfully!")
          }}
        />
      )}
    </div>
  )
}
