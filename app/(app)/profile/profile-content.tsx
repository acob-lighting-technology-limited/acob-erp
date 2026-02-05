"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatName } from "@/lib/utils"
import {
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
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
  Briefcase,
  Clock,
} from "lucide-react"
import { getRoleDisplayName, getRoleBadgeColor } from "@/lib/permissions"
import type { UserRole } from "@/types/database"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { UserProfile, Task, Asset, Documentation, Feedback } from "./page"

interface ProfileContentProps {
  profile: UserProfile | null
  tasks: Task[]
  assets: Asset[]
  documentation: Documentation[]
  feedback: Feedback[]
}

export function ProfileContent({ profile, tasks, assets, documentation, feedback }: ProfileContentProps) {
  const router = useRouter()

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

  // Calculate time at ACOB using employment_date if available
  const employmentDate = profile?.employment_date ? new Date(profile.employment_date) : null
  const daysAtAcob = employmentDate ? Math.floor((Date.now() - employmentDate.getTime()) / (1000 * 60 * 60 * 24)) : null

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

  const quickActions = [
    { name: "Email Signature", href: "/signature", icon: FileSignature, description: "Create professional signature" },
    { name: "Submit Feedback", href: "/feedback", icon: MessageSquare, description: "Share your thoughts" },
    { name: "Watermark Tool", href: "/watermark", icon: Droplet, description: "Add watermarks to images" },
    { name: "Payments", href: "/payments", icon: CreditCard, description: "Manage department payments" },
  ]

  return (
    <div className="container mx-auto max-w-full space-y-6 p-4 md:p-6 lg:p-8">
      {/* Profile Hero Card */}
      <Card className="relative overflow-hidden">
        {/* Edit Button - Absolute positioned */}
        <Button
          onClick={() => router.push("/profile/edit")}
          variant="outline"
          className="bg-background/80 absolute top-4 right-4 z-10 gap-2 backdrop-blur-sm"
        >
          <Edit className="h-4 w-4" />
          Edit Profile
        </Button>

        {/* Banner */}
        <div className="bg-primary/10 h-28 md:h-36 lg:h-44" />

        <CardContent className="relative px-6 pb-6">
          {/* Avatar and Name */}
          <div className="-mt-14 flex items-end gap-4 md:-mt-16 lg:-mt-20 lg:gap-6">
            <Avatar className="border-background h-28 w-28 border-4 shadow-lg md:h-32 md:w-32 lg:h-40 lg:w-40">
              <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold md:text-4xl lg:text-5xl">
                {getInitials(profile?.first_name, profile?.last_name)}
              </AvatarFallback>
            </Avatar>
            <div className="pb-2 lg:pb-4">
              <h1 className="text-xl font-bold md:text-2xl lg:text-3xl">
                {formatName(profile?.first_name)}
                {profile?.other_names && ` ${formatName(profile.other_names)}`}
                {` ${formatName(profile?.last_name)}`}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5">
                <p className="text-muted-foreground flex items-center gap-1.5 text-sm md:text-base lg:text-lg">
                  <Briefcase className="h-4 w-4 lg:h-5 lg:w-5" />
                  {profile?.company_role || "Staff Member"}
                </p>
                <p className="text-muted-foreground flex items-center gap-1.5 text-sm md:text-base lg:text-lg">
                  <Building2 className="h-4 w-4 lg:h-5 lg:w-5" />
                  {profile?.department || "Unassigned Department"}
                </p>
              </div>
            </div>
          </div>

          {/* Role & Status Badges */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* Primary Role Badge - Role-specific colors */}
            {(() => {
              // Define role-specific colors
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
                staff: {
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
              const colors = roleColors[profile.role] || roleColors.staff

              return (
                <div
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${colors.bg} border ${colors.border}`}
                >
                  <div className={`h-2 w-2 rounded-full ${colors.dot} animate-pulse`} />
                  <span className={`text-sm font-semibold ${colors.text}`}>
                    {getRoleDisplayName(profile.role as UserRole)}
                  </span>
                </div>
              )
            })()}

            {profile?.is_department_lead && (
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

      {/* Contact Information */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
              <Mail className="text-muted-foreground h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">Email</p>
                <p className="truncate text-sm font-medium">{profile?.company_email}</p>
              </div>
            </div>

            <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
              <Phone className="text-muted-foreground h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">Phone</p>
                <p className="text-sm font-medium">{profile?.phone_number || "Not set"}</p>
              </div>
            </div>

            <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
              <MapPin className="text-muted-foreground h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">Work Location</p>
                <p className="truncate text-sm font-medium">{profile?.current_work_location || "Not set"}</p>
              </div>
            </div>

            <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
              <MapPin className="text-muted-foreground h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">Residential Address</p>
                <p className="truncate text-sm font-medium">{profile?.residential_address || "Not set"}</p>
              </div>
            </div>

            <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
              <Calendar className="text-muted-foreground h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">Joined ACOB</p>
                <p className="text-sm font-medium">
                  {employmentDate
                    ? employmentDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                    : "Not set - Edit profile to add"}
                </p>
              </div>
            </div>

            {profile?.additional_phone && (
              <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
                <Phone className="text-muted-foreground h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">Additional Phone</p>
                  <p className="text-sm font-medium">{profile.additional_phone}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {quickActions.map((action) => (
              <Link key={action.name} href={action.href}>
                <div className="hover:border-primary/50 hover:bg-muted/50 flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors">
                  <div className="bg-primary/10 rounded-full p-3">
                    <action.icon className="text-primary h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium">{action.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Your Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="assets">
            <TabsList className="mb-4">
              <TabsTrigger value="assets" className="gap-1.5">
                <Package className="h-4 w-4" />
                Assets ({assets.length})
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-1.5">
                <CheckSquare className="h-4 w-4" />
                Tasks ({tasks.length})
              </TabsTrigger>
              <TabsTrigger value="documentation" className="gap-1.5">
                <FileText className="h-4 w-4" />
                Docs ({documentation.length})
              </TabsTrigger>
              <TabsTrigger value="feedback" className="gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Feedback ({feedback.length})
              </TabsTrigger>
            </TabsList>

            {/* Tasks Tab */}
            <TabsContent value="tasks">
              {tasks.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">S/N</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.slice(0, 5).map((task, index) => (
                        <TableRow key={task.id}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="font-medium">{task.title}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                          </TableCell>
                          <TableCell>{task.due_date ? new Date(task.due_date).toLocaleDateString() : "-"}</TableCell>
                          <TableCell className="text-right">
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
                </div>
              ) : (
                <div className="bg-muted/30 rounded-lg border py-12 text-center">
                  <CheckSquare className="text-muted-foreground/50 mx-auto mb-3 h-10 w-10" />
                  <p className="text-muted-foreground">No tasks assigned</p>
                </div>
              )}
            </TabsContent>

            {/* Assets Tab */}
            <TabsContent value="assets">
              {assets.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">S/N</TableHead>
                        <TableHead>Asset Type</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Assignment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assets.slice(0, 5).map((asset, index) => (
                        <TableRow key={asset.id}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="font-medium">{asset.asset_type}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {asset.unique_code || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell>{asset.asset_model || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {asset.assignment_type === "department" && "Dept"}
                              {asset.assignment_type === "office" && "Office"}
                              {asset.assignment_type === "individual" && "Personal"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(asset.status)}>{asset.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href="/assets" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                              View
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="bg-muted/30 rounded-lg border py-12 text-center">
                  <Package className="text-muted-foreground/50 mx-auto mb-3 h-10 w-10" />
                  <p className="text-muted-foreground">No assets assigned</p>
                </div>
              )}
            </TabsContent>

            {/* Documentation Tab */}
            <TabsContent value="documentation">
              {documentation.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">S/N</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documentation.slice(0, 5).map((doc, index) => (
                        <TableRow key={doc.id}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="font-medium">{doc.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{doc.category || "N/A"}</Badge>
                          </TableCell>
                          <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
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
                </div>
              ) : (
                <div className="bg-muted/30 rounded-lg border py-12 text-center">
                  <FileText className="text-muted-foreground/50 mx-auto mb-3 h-10 w-10" />
                  <p className="text-muted-foreground">No documentation created</p>
                </div>
              )}
            </TabsContent>

            {/* Feedback Tab */}
            <TabsContent value="feedback">
              {feedback.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">S/N</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feedback.slice(0, 5).map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="font-medium">{item.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.feedback_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                          </TableCell>
                          <TableCell>{new Date(item.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
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
                </div>
              ) : (
                <div className="bg-muted/30 rounded-lg border py-12 text-center">
                  <MessageSquare className="text-muted-foreground/50 mx-auto mb-3 h-10 w-10" />
                  <p className="text-muted-foreground">No feedback submitted</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
