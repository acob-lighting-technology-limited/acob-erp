"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Package, CheckSquare, FileText, MessageSquare } from "lucide-react"
import type { Task, Asset, Documentation, Feedback } from "@/app/(app)/profile/page"

function getStatusColor(status: string): string {
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

function getPriorityColor(priority: string): string {
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

interface ActivityTabsProps {
  tasks: Task[]
  assets: Asset[]
  documentation: Documentation[]
  feedback: Feedback[]
}

export function ActivityTabs({ tasks, assets, documentation, feedback }: ActivityTabsProps) {
  return (
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
                            href={`/documentation/internal?docId=${doc.id}`}
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
  )
}
