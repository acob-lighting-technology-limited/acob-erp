"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
import { formatName } from "@/lib/utils"
import type { Employee } from "@/app/admin/hr/employees/admin-employee-content"
import type { EmployeeAssignedItems } from "./types"

interface EmployeeDeletionDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee | null
  assignedItems: EmployeeAssignedItems
  onDelete: () => void
  isDeleting: boolean
}

export function EmployeeDeletionDialog({
  isOpen,
  onOpenChange,
  employee,
  assignedItems,
  onDelete,
  isDeleting,
}: EmployeeDeletionDialogProps) {
  const hasAssignments =
    assignedItems.tasks.length > 0 ||
    assignedItems.taskAssignments.length > 0 ||
    assignedItems.assets.length > 0 ||
    assignedItems.projects.length > 0 ||
    assignedItems.projectMemberships.length > 0 ||
    assignedItems.feedback.length > 0 ||
    assignedItems.documentation.length > 0

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Deletion Disabled
          </DialogTitle>
          <DialogDescription>
            {employee
              ? `${formatName(employee.first_name)} ${formatName(employee.last_name)} cannot be deleted.`
              : "Employee deletion is disabled."}
          </DialogDescription>
        </DialogHeader>

        {/* Check for assigned items */}
        {hasAssignments ? (
          <div className="space-y-4 py-4">
            <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
                <div className="flex-1">
                  <h4 className="text-destructive mb-2 font-semibold">Deletion Is Disabled</h4>
                  <p className="text-muted-foreground mb-4 text-sm">
                    This employee has items assigned to them. Use reassignment, suspension, or deactivation instead of
                    deletion.
                  </p>

                  <div className="space-y-3">
                    {assignedItems.tasks.length > 0 && (
                      <div>
                        <p className="text-foreground mb-1 text-sm font-medium">Tasks ({assignedItems.tasks.length})</p>
                        <div className="max-h-32 space-y-1 overflow-y-auto">
                          {assignedItems.tasks.slice(0, 5).map((task) => (
                            <div key={task.id} className="text-muted-foreground bg-background rounded p-2 text-xs">
                              • {task.title} ({task.status})
                            </div>
                          ))}
                          {assignedItems.tasks.length > 5 && (
                            <p className="text-muted-foreground text-xs">
                              ...and {assignedItems.tasks.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {assignedItems.taskAssignments.length > 0 && (
                      <div>
                        <p className="text-foreground mb-1 text-sm font-medium">
                          Task Assignments ({assignedItems.taskAssignments.length})
                        </p>
                        <div className="max-h-32 space-y-1 overflow-y-auto">
                          {assignedItems.taskAssignments.slice(0, 5).map((assignment) => (
                            <div
                              key={assignment.id}
                              className="text-muted-foreground bg-background rounded p-2 text-xs"
                            >
                              • {assignment.Task?.title || "Unknown Task"} ({assignment.Task?.status || "N/A"})
                            </div>
                          ))}
                          {assignedItems.taskAssignments.length > 5 && (
                            <p className="text-muted-foreground text-xs">
                              ...and {assignedItems.taskAssignments.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {assignedItems.assets.length > 0 && (
                      <div>
                        <p className="text-foreground mb-1 text-sm font-medium">
                          Assets ({assignedItems.assets.length})
                        </p>
                        <div className="max-h-32 space-y-1 overflow-y-auto">
                          {assignedItems.assets.slice(0, 5).map((assignment) => (
                            <div
                              key={assignment.id}
                              className="text-muted-foreground bg-background rounded p-2 text-xs"
                            >
                              •{" "}
                              {assignment.Asset?.asset_name === "Unknown Asset" || !assignment.Asset?.asset_name
                                ? `Unknown Asset (${assignment.Asset?.unique_code || "No Code"})`
                                : assignment.Asset.asset_name}
                              ({assignment.Asset?.asset_type || "N/A"})
                            </div>
                          ))}
                        </div>
                        {assignedItems.assets.length > 5 && (
                          <p className="text-muted-foreground text-xs">...and {assignedItems.assets.length - 5} more</p>
                        )}
                      </div>
                    )}

                    {assignedItems.projects.length > 0 && (
                      <div>
                        <p className="text-foreground mb-1 text-sm font-medium">
                          Projects ({assignedItems.projects.length})
                        </p>
                        <div className="max-h-32 space-y-1 overflow-y-auto">
                          {assignedItems.projects.slice(0, 5).map((project) => (
                            <div key={project.id} className="text-muted-foreground bg-background rounded p-2 text-xs">
                              • {project.project_name} ({project.status})
                            </div>
                          ))}
                          {assignedItems.projects.length > 5 && (
                            <p className="text-muted-foreground text-xs">
                              ...and {assignedItems.projects.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {assignedItems.projectMemberships.length > 0 && (
                      <div>
                        <p className="text-foreground mb-1 text-sm font-medium">
                          Project Memberships ({assignedItems.projectMemberships.length})
                        </p>
                        <div className="max-h-32 space-y-1 overflow-y-auto">
                          {assignedItems.projectMemberships.slice(0, 5).map((membership) => (
                            <div
                              key={membership.id}
                              className="text-muted-foreground bg-background rounded p-2 text-xs"
                            >
                              • {membership.Project?.project_name || "Unknown Project"}
                            </div>
                          ))}
                          {assignedItems.projectMemberships.length > 5 && (
                            <p className="text-muted-foreground text-xs">
                              ...and {assignedItems.projectMemberships.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {assignedItems.feedback.length > 0 && (
                      <div>
                        <p className="text-foreground mb-1 text-sm font-medium">
                          Feedback ({assignedItems.feedback.length})
                        </p>
                        <div className="max-h-32 space-y-1 overflow-y-auto">
                          {assignedItems.feedback.slice(0, 5).map((fb) => (
                            <div key={fb.id} className="text-muted-foreground bg-background rounded p-2 text-xs">
                              • {fb.title} ({fb.status})
                            </div>
                          ))}
                          {assignedItems.feedback.length > 5 && (
                            <p className="text-muted-foreground text-xs">
                              ...and {assignedItems.feedback.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {assignedItems.documentation.length > 0 && (
                      <div>
                        <p className="text-foreground mb-1 text-sm font-medium">
                          Documentation ({assignedItems.documentation.length})
                        </p>
                        <div className="max-h-32 space-y-1 overflow-y-auto">
                          {assignedItems.documentation.slice(0, 5).map((doc) => (
                            <div key={doc.id} className="text-muted-foreground bg-background rounded p-2 text-xs">
                              • {doc.title}
                            </div>
                          ))}
                          {assignedItems.documentation.length > 5 && (
                            <p className="text-muted-foreground text-xs">
                              ...and {assignedItems.documentation.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
                <div className="flex-1">
                  <h4 className="text-destructive mb-2 font-semibold">Warning: This action cannot be undone</h4>
                  <p className="text-muted-foreground text-sm">
                    Deleting this employees member will permanently remove their profile and all associated data from
                    the system. This action cannot be reversed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          {hasAssignments ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : (
            <Button variant="destructive" onClick={onDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disabled...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Deletion Disabled
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
