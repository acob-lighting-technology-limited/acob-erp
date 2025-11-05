"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatName } from "@/lib/utils"
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
  Shield,
  Calendar,
  FileText,
  Laptop,
  Package,
  CheckSquare,
  ScrollText,
  MessageSquare,
  Edit,
} from "lucide-react"
import { getRoleDisplayName, getRoleBadgeColor } from "@/lib/permissions"
import type { UserRole } from "@/types/database"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface UserProfile {
  id: string
  first_name: string
  last_name: string
  other_names: string | null
  company_email: string
  department: string
  company_role: string | null
  role: string
  phone_number: string | null
  additional_phone: string | null
  residential_address: string | null
  current_work_location: string | null
  site_name: string | null
  site_state: string | null
  is_admin: boolean
  is_department_lead: boolean
  lead_departments: string[]
  created_at: string
  updated_at: string
}

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  department: string | null
  due_date: string | null
  created_at: string
}

interface Device {
  id: string
  device_name: string
  device_type: string
  device_model: string | null
  serial_number: string | null
  status: string
  assigned_at: string
}

interface Asset {
  id: string
  asset_name: string
  asset_type: string
  asset_model: string | null
  serial_number: string | null
  status: string
  assigned_at: string
}

interface Documentation {
  id: string
  title: string
  category: string | null
  created_at: string
}

interface AuditLog {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  old_values: any
  new_values: any
  created_at: string
}

interface Feedback {
  id: string
  feedback_type: string
  title: string
  description: string | null
  status: string
  created_at: string
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params?.userId as string

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [documentation, setDocumentation] = useState<Documentation[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    if (userId) {
      loadUserData()
    }
  }, [userId])

  const loadUserData = async () => {
    try {
      setIsLoading(true)

      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()

      if (profileError) throw profileError
      if (!profileData) {
        toast.error("User not found")
        router.push("/admin/staff")
        return
      }

      setProfile(profileData)

      // Load tasks assigned to user
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", userId)
        .order("created_at", { ascending: false })

      if (tasksData) setTasks(tasksData)

      // Load devices assigned to user
      const { data: deviceAssignments } = await supabase
        .from("device_assignments")
        .select("device_id, assigned_at")
        .eq("assigned_to", userId)
        .eq("is_current", true)

      if (deviceAssignments && deviceAssignments.length > 0) {
        const deviceIds = deviceAssignments.map((da) => da.device_id)
        const { data: devicesData } = await supabase
          .from("devices")
          .select("*")
          .in("id", deviceIds)

        if (devicesData) {
          const devicesWithAssignment = devicesData.map((device) => {
            const assignment = deviceAssignments.find((da) => da.device_id === device.id)
            return {
              ...device,
              assigned_at: assignment?.assigned_at || device.created_at,
            }
          })
          setDevices(devicesWithAssignment)
        }
      }

      // Load assets assigned to user
      const { data: assetAssignments } = await supabase
        .from("asset_assignments")
        .select("asset_id, assigned_at")
        .eq("assigned_to", userId)
        .eq("is_current", true)

      if (assetAssignments && assetAssignments.length > 0) {
        const assetIds = assetAssignments.map((aa) => aa.asset_id)
        const { data: assetsData } = await supabase
          .from("assets")
          .select("*")
          .in("id", assetIds)

        if (assetsData) {
          const assetsWithAssignment = assetsData.map((asset) => {
            const assignment = assetAssignments.find((aa) => aa.asset_id === asset.id)
            return {
              ...asset,
              assigned_at: assignment?.assigned_at || asset.created_at,
            }
          })
          setAssets(assetsWithAssignment)
        }
      }

      // Load documentation created by user
      const { data: docsData } = await supabase
        .from("user_documentation")
        .select("id, title, category, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (docsData) setDocumentation(docsData)

      // Load audit logs related to user
      const { data: logsData } = await supabase
        .from("audit_logs")
        .select("*")
        .or(`user_id.eq.${userId},entity_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(50)

      if (logsData) setAuditLogs(logsData)

      // Load feedback submitted by user
      const { data: feedbackData } = await supabase
        .from("feedback")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (feedbackData) setFeedback(feedbackData)
    } catch (error: any) {
      console.error("Error loading user data:", error)
      toast.error("Failed to load user data")
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "pending":
      case "open":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      case "assigned":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading user data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">User not found</p>
            <Button onClick={() => router.push("/admin/staff")} className="mt-4">
              Back to Staff
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const fullName = `${formatName(profile.first_name)} ${formatName(profile.last_name)}`
  const initials = `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase()

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/staff")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{fullName}</h1>
            <p className="text-muted-foreground">{profile.company_email}</p>
          </div>
        </div>
        <Button onClick={() => router.push(`/admin/staff?userId=${userId}`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Profile
        </Button>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">{fullName}</p>
                {profile.other_names && (
                  <p className="text-xs text-muted-foreground">({profile.other_names})</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{profile.company_email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Department</p>
                <p className="font-medium">{profile.department || "N/A"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <div className="flex gap-2 mt-1">
                  <Badge className={getRoleBadgeColor(profile.role as UserRole)}>
                    {getRoleDisplayName(profile.role as UserRole)}
                  </Badge>
                  {profile.is_department_lead && (
                    <Badge variant="outline">Department Lead</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Position</p>
                <p className="font-medium">{profile.company_role || "N/A"}</p>
              </div>
            </div>

            {profile.phone_number && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{profile.phone_number}</p>
                  {profile.additional_phone && (
                    <p className="text-xs text-muted-foreground">{profile.additional_phone}</p>
                  )}
                </div>
              </div>
            )}

            {profile.residential_address && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{profile.residential_address}</p>
                </div>
              </div>
            )}

            {profile.current_work_location && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Work Location</p>
                  <p className="font-medium">{profile.current_work_location}</p>
                </div>
              </div>
            )}

            {profile.lead_departments && profile.lead_departments.length > 0 && (
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Leading Departments</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {profile.lead_departments.map((dept) => (
                      <Badge key={dept} variant="outline">
                        {dept}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Member Since</p>
                <p className="font-medium">
                  {new Date(profile.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Related Data */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks">
            <CheckSquare className="h-4 w-4 mr-2" />
            Tasks ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="devices">
            <Laptop className="h-4 w-4 mr-2" />
            Devices ({devices.length})
          </TabsTrigger>
          <TabsTrigger value="assets">
            <Package className="h-4 w-4 mr-2" />
            Assets ({assets.length})
          </TabsTrigger>
          <TabsTrigger value="documentation">
            <FileText className="h-4 w-4 mr-2" />
            Documentation ({documentation.length})
          </TabsTrigger>
          <TabsTrigger value="feedback">
            <MessageSquare className="h-4 w-4 mr-2" />
            Feedback ({feedback.length})
          </TabsTrigger>
          <TabsTrigger value="logs">
            <ScrollText className="h-4 w-4 mr-2" />
            Audit Logs ({auditLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(task.status)}>
                            {task.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>{task.department || "N/A"}</TableCell>
                        <TableCell>
                          {task.due_date
                            ? new Date(task.due_date).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <Link href={`/admin/tasks?taskId=${task.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No tasks assigned to this user
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Devices</CardTitle>
            </CardHeader>
            <CardContent>
              {devices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Serial Number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-medium">{device.device_name}</TableCell>
                        <TableCell>{device.device_type}</TableCell>
                        <TableCell>{device.device_model || "N/A"}</TableCell>
                        <TableCell>{device.serial_number || "N/A"}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(device.status)}>
                            {device.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(device.assigned_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <Link href={`/admin/devices?deviceId=${device.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No devices assigned to this user
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Assets</CardTitle>
            </CardHeader>
            <CardContent>
              {assets.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Serial Number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium">{asset.asset_name}</TableCell>
                        <TableCell>{asset.asset_type}</TableCell>
                        <TableCell>{asset.asset_model || "N/A"}</TableCell>
                        <TableCell>{asset.serial_number || "N/A"}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(asset.status)}>
                            {asset.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(asset.assigned_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <Link href={`/admin/assets?assetId=${asset.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No assets assigned to this user
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documentation Tab */}
        <TabsContent value="documentation">
          <Card>
            <CardHeader>
              <CardTitle>Documentation Created</CardTitle>
            </CardHeader>
            <CardContent>
              {documentation.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentation.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{doc.category || "N/A"}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(doc.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <Link href={`/admin/documentation?docId=${doc.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No documentation created by this user
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback">
          <Card>
            <CardHeader>
              <CardTitle>Feedback Submitted</CardTitle>
            </CardHeader>
            <CardContent>
              {feedback.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedback.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.feedback_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(item.status)}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(item.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <Link href={`/admin/feedback?feedbackId=${item.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No feedback submitted by this user
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity Type</TableHead>
                      <TableHead>Entity ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell>{log.entity_type}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.entity_id?.substring(0, 8) || "N/A"}
                        </TableCell>
                        <TableCell>
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <Link href={`/admin/audit-logs?logId=${log.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No audit logs found for this user
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

