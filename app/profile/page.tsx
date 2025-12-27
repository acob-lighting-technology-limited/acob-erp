"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatName } from "@/lib/utils"
import {
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
  Shield,
  Calendar,
  FileText,
  Package,
  CheckSquare,
  MessageSquare,
  Edit,
  ArrowRight,
  Droplet,
  FileSignature,
  CreditCard,
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
  assignment_type?: "individual" | "multiple" | "department"
}

interface Asset {
  id: string
  asset_name?: string
  asset_type: string
  asset_model: string | null
  serial_number: string | null
  unique_code: string | null
  status: string
  assigned_at: string
  assignment_type?: "individual" | "department" | "office"
  department?: string
  office_location?: string
}

interface Documentation {
  id: string
  title: string
  category: string | null
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

export default function ProfilePage() {
  const router = useRouter()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [documentation, setDocumentation] = useState<Documentation[]>([])
  const [feedback, setFeedback] = useState<Feedback[]>([])

  const supabase = createClient()

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) {
        toast.error("Please log in to view your profile")
        router.push("/auth/login")
        return
      }

      const userId = user.id

      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()

      if (profileError) throw profileError
      if (!profileData) {
        toast.error("Profile not found")
        return
      }

      setProfile(profileData)

      // Load tasks assigned to user (individual, multiple-user, and department tasks)
      const { data: individualTasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", userId)
        .order("created_at", { ascending: false })

      // Load multiple-user tasks
      const { data: taskAssignments } = await supabase.from("task_assignments").select("task_id").eq("user_id", userId)

      let multipleUserTasks: Task[] = []
      if (taskAssignments && taskAssignments.length > 0) {
        const taskIds = taskAssignments.map((ta: any) => ta.task_id)
        const { data: tasksData } = await supabase
          .from("tasks")
          .select("*")
          .in("id", taskIds)
          .eq("assignment_type", "multiple")
          .order("created_at", { ascending: false })
        if (tasksData) multipleUserTasks = tasksData
      }

      // Load department tasks
      const { data: departmentTasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("department", profileData.department)
        .eq("assignment_type", "department")
        .order("created_at", { ascending: false })

      const allTasks = [...(individualTasks || []), ...multipleUserTasks, ...(departmentTasks || [])]
      setTasks(allTasks)

      setTasks(allTasks)

      // Load assets assigned to user (individual)
      const { data: individualAssignments } = await supabase
        .from("asset_assignments")
        .select(
          `
          assigned_at,
          asset:assets(
            id,
            asset_type,
            asset_model,
            serial_number,
            status,
            unique_code,
            created_at
          )
        `
        )
        .eq("assigned_to", userId)
        .eq("is_current", true)

      // Load department and office assets
      const { data: sharedAssets } = await supabase
        .from("assets")
        .select("*")
        .eq("status", "assigned")
        .or(
          `and(assignment_type.eq.department,department.eq.${profileData.department}),and(assignment_type.eq.office,office_location.eq.${profileData.office_location})`
        )

      let allAssets: Asset[] = []

      // Process individual assignments
      if (individualAssignments) {
        const indAssets = individualAssignments.map((a: any) => ({
          ...a.asset,
          assigned_at: a.assigned_at,
          assignment_type: "individual" as const,
        }))
        allAssets = [...allAssets, ...indAssets]
      }

      // Process shared assets
      if (sharedAssets) {
        const shAssets = sharedAssets.map((a: any) => ({
          ...a,
          assigned_at: a.created_at, // Use created_at for shared assets
          assignment_type: a.assignment_type,
        }))
        allAssets = [...allAssets, ...shAssets]
      }

      setAssets(allAssets)

      // Load documentation created by user
      const { data: docsData } = await supabase
        .from("user_documentation")
        .select("id, title, category, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (docsData) setDocumentation(docsData)

      // Load feedback submitted by user
      const { data: feedbackData } = await supabase
        .from("feedback")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (feedbackData) setFeedback(feedbackData)
    } catch (error: any) {
      console.error("Error loading user data:", error)
      toast.error("Failed to load profile data")
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

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase()
  }

  if (!profile) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">Profile not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const fullName = `${formatName(profile.first_name)} ${formatName(profile.last_name)}`
  const quickActions = [
    {
      name: "Email Signature",
      href: "/signature",
      icon: FileSignature,
      description: "Create professional signature",
      color: "bg-blue-500",
    },
    {
      name: "Submit Feedback",
      href: "/feedback",
      icon: MessageSquare,
      description: "Share your thoughts",
      color: "bg-green-500",
    },
    {
      name: "Watermark Tool",
      href: "/watermark",
      icon: Droplet,
      description: "Add watermarks",
      color: "bg-purple-500",
    },
    {
      name: "Payments",
      href: "/payments",
      icon: CreditCard,
      description: "Manage department payments",
      color: "bg-orange-500",
    },
  ]

  return (
    <div className="from-background via-background to-muted/20 min-h-screen bg-gradient-to-br">
      <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
        {/* Header */}
        <div>
          <h1 className="text-foreground text-3xl font-bold md:text-4xl">
            Welcome back, {profile?.first_name || "Staff Member"}!
          </h1>
          <p className="text-muted-foreground mt-2">Here's what's happening with your account today.</p>
        </div>

        {/* Profile Card */}
        <Card className="overflow-hidden border-2 shadow-lg">
          <div className="from-primary/10 via-primary/5 to-background bg-gradient-to-r p-6 md:p-8">
            <div className="flex flex-col gap-8">
              {/* Top Section: Avatar, Name & Edit Button */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="ring-background h-20 w-20 shadow-xl ring-4">
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                      {getInitials(profile?.first_name, profile?.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-foreground text-2xl font-bold">
                      {formatName(profile?.first_name)}
                      {profile?.other_names && ` ${formatName(profile.other_names)}`}
                      {` ${formatName(profile?.last_name)}`}
                    </h2>
                    <p className="text-muted-foreground">{profile?.company_role || "Staff Member"}</p>
                  </div>
                </div>
                <Button onClick={() => router.push("/profile/edit")} variant="outline" className="gap-2">
                  <Edit className="h-4 w-4" />
                  Edit Profile
                </Button>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center gap-3">
                  <User className="text-muted-foreground h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground text-sm">Full Name</p>
                    <p className="font-medium">
                      {formatName(profile?.first_name)}
                      {profile?.other_names && ` ${formatName(profile.other_names)}`}
                      {` ${formatName(profile?.last_name)}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="text-muted-foreground h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground text-sm">Email</p>
                    <p className="font-medium">{profile?.company_email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Building2 className="text-muted-foreground h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground text-sm">Department</p>
                    <p className="font-medium">{profile?.department || "N/A"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Shield className="text-muted-foreground h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground text-sm">Role</p>
                    <div className="mt-1">
                      <Badge className={getRoleBadgeColor(profile.role as UserRole)}>
                        {getRoleDisplayName(profile.role as UserRole)}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <User className="text-muted-foreground h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground text-sm">Position</p>
                    <p className="font-medium">{profile?.company_role || "N/A"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="text-muted-foreground h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground text-sm">Phone</p>
                    <p className="font-medium">{profile?.phone_number || "N/A"}</p>
                    {profile?.additional_phone && (
                      <p className="text-muted-foreground text-xs">{profile.additional_phone}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MapPin className="text-muted-foreground h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground text-sm">Address</p>
                    <p className="font-medium">{profile?.residential_address || "N/A"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MapPin className="text-muted-foreground h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground text-sm">Work Location</p>
                    <p className="font-medium">{profile?.current_work_location || "N/A"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="text-muted-foreground h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground text-sm">Member Since</p>
                    <p className="font-medium">{new Date(profile.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <div>
          <h3 className="mb-4 text-xl font-semibold">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <Link key={action.name} href={action.href} className="h-full">
                <Card className="group hover:border-primary flex h-full cursor-pointer flex-col border-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <CardContent className="flex-1 p-4">
                    <div className="flex h-full items-start gap-4">
                      <div className={`${action.color} shrink-0 rounded-lg p-2 text-white`}>
                        <action.icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-foreground group-hover:text-primary font-semibold transition-colors">
                          {action.name}
                        </h4>
                        <p className="text-muted-foreground mt-1 text-sm">{action.description}</p>
                      </div>
                      <ArrowRight className="text-muted-foreground group-hover:text-primary h-5 w-5 shrink-0 transition-all group-hover:translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Tabs for Related Data */}
        <Tabs defaultValue="assets" className="space-y-4">
          <TabsList>
            <TabsTrigger value="assets">
              <Package className="mr-2 h-4 w-4" />
              Assets ({assets.length})
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <CheckSquare className="mr-2 h-4 w-4" />
              Tasks ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="documentation">
              <FileText className="mr-2 h-4 w-4" />
              Documentation ({documentation.length})
            </TabsTrigger>
            <TabsTrigger value="feedback">
              <MessageSquare className="mr-2 h-4 w-4" />
              Feedback ({feedback.length})
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
                            <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                          </TableCell>
                          <TableCell>{task.department || "N/A"}</TableCell>
                          <TableCell>{task.due_date ? new Date(task.due_date).toLocaleDateString() : "N/A"}</TableCell>
                          <TableCell>
                            <Link
                              href={`/tasks?taskId=${task.id}`}
                              className={buttonVariants({ variant: "ghost", size: "sm" })}
                            >
                              View
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground py-8 text-center">No tasks assigned</p>
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
                        <TableHead className="w-[50px]">S/N</TableHead>
                        <TableHead>Asset Type</TableHead>
                        <TableHead>Unique Code</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Assignment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assets.map((asset, index) => (
                        <TableRow key={asset.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell className="font-medium">{asset.asset_type}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              {asset.unique_code || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell>{asset.asset_model || "-"}</TableCell>
                          <TableCell>{asset.serial_number || "-"}</TableCell>
                          <TableCell>
                            {asset.assignment_type === "department" && (
                              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                <Building2 className="mr-1 h-3 w-3" />
                                Department
                              </Badge>
                            )}
                            {asset.assignment_type === "office" && (
                              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                                <MapPin className="mr-1 h-3 w-3" />
                                Office
                              </Badge>
                            )}
                            {asset.assignment_type === "individual" && (
                              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                <User className="mr-1 h-3 w-3" />
                                Personal
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(asset.status)}>{asset.status}</Badge>
                          </TableCell>
                          <TableCell>{new Date(asset.assigned_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Link href={`/assets`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                              View
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground py-8 text-center">No assets assigned</p>
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
                          <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Link
                              href={`/documentation?docId=${doc.id}`}
                              className={buttonVariants({ variant: "ghost", size: "sm" })}
                            >
                              View
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground py-8 text-center">No documentation created</p>
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
                            <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                          </TableCell>
                          <TableCell>{new Date(item.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Link
                              href={`/feedback?feedbackId=${item.id}`}
                              className={buttonVariants({ variant: "ghost", size: "sm" })}
                            >
                              View
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground py-8 text-center">No feedback submitted</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
