"use client"

import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatWATDate } from "@/lib/utils/date"
import { toast } from "sonner"
import { Edit2, FileText, MessageSquare, Plus, Star, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FeedbackForm } from "@/components/feedback-form"
import { FeedbackEditModal } from "@/components/feedback-edit-modal"
import { SystemSurveyModal } from "@/components/survey/system-survey-modal"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import type { Feedback } from "./page"
import type { SystemSatisfactionSurvey } from "@/types/survey"
import { writeAuditLogClient } from "@/lib/audit/client"
import { logger } from "@/lib/logger"

const log = logger("feedback-feedback-content")

interface FeedbackContentProps {
  initialFeedback: Feedback[]
  initialSurvey?: SystemSatisfactionSurvey | null
}

export function FeedbackContent({ initialFeedback, initialSurvey }: FeedbackContentProps) {
  const [userFeedback, setUserFeedback] = useState<Feedback[]>(initialFeedback)
  const [userSurvey, setUserSurvey] = useState<SystemSatisfactionSurvey | null>(initialSurvey || null)
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"non_anonymous" | "anonymous">("non_anonymous")
  const [isSubmitOpen, setIsSubmitOpen] = useState(false)
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isDeletingFeedback, setIsDeletingFeedback] = useState(false)

  const getTypeColor = (type: string) => {
    if (type === "concern") return "bg-yellow-100 text-yellow-800"
    if (type === "complaint") return "bg-red-100 text-red-800"
    if (type === "suggestion") return "bg-blue-100 text-blue-800"
    if (type === "required_item") return "bg-violet-100 text-violet-800"
    return "bg-gray-100 text-gray-800"
  }

  const getStatusColor = (status: string) => {
    if (status === "open") return "bg-green-100 text-green-800"
    if (status === "in_progress") return "bg-blue-100 text-blue-800"
    if (status === "resolved") return "bg-violet-100 text-violet-800"
    if (status === "closed") return "bg-gray-100 text-gray-800"
    return "bg-gray-100 text-gray-800"
  }

  const handleFeedbackSubmitted = (newFeedback: Feedback) => {
    setUserFeedback((current) => [newFeedback, ...current])
    setIsSubmitOpen(false)
  }

  const filteredFeedback = useMemo(
    () => userFeedback.filter((item) => (activeTab === "anonymous" ? Boolean(item.is_anonymous) : !item.is_anonymous)),
    [userFeedback, activeTab]
  )

  const tabs: DataTableTab[] = useMemo(
    () => [
      {
        key: "non_anonymous",
        label: `Non-Anonymous (${userFeedback.filter((item) => !item.is_anonymous).length})`,
      },
      {
        key: "anonymous",
        label: `Anonymous (${userFeedback.filter((item) => Boolean(item.is_anonymous)).length})`,
      },
    ],
    [userFeedback]
  )

  const handleDelete = async (id: string) => {
    const supabase = createClient()

    try {
      const feedbackToDelete = userFeedback.find((item) => item.id === id)
      const { error } = await supabase.from("feedback").delete().eq("id", id)
      if (error) throw error

      if (feedbackToDelete) {
        try {
          await writeAuditLogClient(
            supabase,
            {
              action: "delete",
              entityType: "feedback",
              entityId: id,
              oldValues: {
                feedback_type: feedbackToDelete.feedback_type,
                title: feedbackToDelete.title,
                description: feedbackToDelete.description,
                status: feedbackToDelete.status,
              },
              context: {
                source: "ui",
                route: "/tools/feedback",
              },
            },
            { failOpen: true }
          )
        } catch (auditError) {
          log.error("Failed to log audit for feedback deletion:", auditError)
        }
      }

      setUserFeedback((current) => current.filter((item) => item.id !== id))
      toast.success("Feedback deleted successfully!")
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete feedback")
    }
  }

  const columns = useMemo<DataTableColumn<Feedback>[]>(
    () => [
      {
        key: "title",
        label: "Title",
        sortable: true,
        accessor: (row) => row.title,
        resizable: true,
        initialWidth: 280,
        render: (row) => <span className="font-medium">{row.title}</span>,
      },
      {
        key: "feedback_type",
        label: "Type",
        sortable: true,
        accessor: (row) => row.feedback_type,
        render: (row) => (
          <Badge className={getTypeColor(row.feedback_type)}>{row.feedback_type.replaceAll("_", " ")}</Badge>
        ),
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        accessor: (row) => row.status,
        render: (row) => <Badge className={getStatusColor(row.status)}>{row.status.replaceAll("_", " ")}</Badge>,
      },
      {
        key: "created_at",
        label: "Created",
        sortable: true,
        accessor: (row) => row.created_at,
        render: (row) => formatWATDate(row.created_at),
        hideOnMobile: true,
      },
    ],
    []
  )

  const filters = useMemo<DataTableFilter<Feedback>[]>(
    () => [
      {
        key: "status",
        label: "Status",
        options: [
          { value: "open", label: "Open" },
          { value: "in_progress", label: "In Progress" },
          { value: "resolved", label: "Resolved" },
          { value: "closed", label: "Closed" },
        ],
      },
      {
        key: "feedback_type",
        label: "Type",
        options: Array.from(new Set(filteredFeedback.map((item) => item.feedback_type))).map((type) => ({
          value: type,
          label: type.replaceAll("_", " "),
        })),
      },
    ],
    [filteredFeedback]
  )

  return (
    <DataTablePage
      title="Feedback & Suggestions"
      description="Share concerns, complaints, suggestions, or required items with management."
      icon={MessageSquare}
      backLink={{ href: "/profile", label: "Back to Dashboard" }}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) => setActiveTab(tab as "non_anonymous" | "anonymous")}
      spacing="tight"
      actionsPlacement="inline-always"
      actions={
        <Button onClick={() => setIsSubmitOpen(true)} size="sm">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Submit Feedback</span>
        </Button>
      }
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Total"
            value={userFeedback.length}
            icon={MessageSquare}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title="Open"
            value={filteredFeedback.filter((item) => item.status === "open").length}
            icon={MessageSquare}
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-500"
          />
          <StatCard
            variant="compact"
            title="Resolved"
            value={filteredFeedback.filter((item) => item.status === "resolved").length}
            icon={MessageSquare}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
        </StatGrid>
      }
    >
      {/* System Satisfaction Survey Card */}
      <div className="border-primary/20 from-primary/5 via-card to-card mb-6 rounded-xl border bg-gradient-to-r p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Star className="h-5 w-5 fill-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">ACOB Matrix ERP Experience Pulse</h3>
                {userSurvey ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-50 text-[10px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    Completed
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 bg-amber-50 text-[10px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    Pending Feedback
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {userSurvey
                  ? `You rated the system ${userSurvey.overall_rating} of 5 stars (${userSurvey.is_anonymous ? "Submitted Anonymously" : "Named Submission"}). Click below to review or update your feedback.`
                  : "Help us evaluate post-deployment usability, speed, and feature satisfaction with a 2-minute survey."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant={userSurvey ? "outline" : "default"}
              size="sm"
              onClick={() => setIsSurveyModalOpen(true)}
              className="h-8 gap-1.5 text-xs"
            >
              <Star className="h-3.5 w-3.5" />
              {userSurvey ? "Review / Edit Survey" : "Take Survey (2 min)"}
            </Button>
          </div>
        </div>
      </div>

      <DataTable<Feedback>
        data={filteredFeedback}
        columns={columns}
        filters={filters}
        getRowId={(row) => row.id}
        pagination={{ pageSize: 50 }}
        searchPlaceholder="Search title, description, type, or status..."
        searchFn={(row, query) =>
          `${row.title} ${row.description || ""} ${row.feedback_type} ${row.status}`.toLowerCase().includes(query)
        }
        stickyToolbar
        viewToggle
        contactsView
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          title: (row) => row.title,
          subtitle: (row) => `${row.feedback_type.replaceAll("_", " ")} · ${row.is_anonymous ? "anonymous" : "named"}`,
          trailing: (row) => (
            <Badge className={`${getStatusColor(row.status)} text-[10px] capitalize`}>
              {row.status.replaceAll("_", " ")}
            </Badge>
          ),
          detail: {
            title: (row) => row.title,
            subtitle: (row) => (
              <span className="text-muted-foreground text-xs capitalize">{row.feedback_type.replaceAll("_", " ")}</span>
            ),
            badges: (row) => (
              <Badge className={`${getStatusColor(row.status)} text-[10px] capitalize`}>
                {row.status.replaceAll("_", " ")}
              </Badge>
            ),
            fields: (row) => [
              { icon: FileText, label: "Description", value: row.description || "No description provided." },
            ],
            actions: (row) => [
              {
                label: "Edit",
                icon: Edit2,
                variant: "outline" as const,
                onClick: () => {
                  setSelectedFeedback(row)
                  setShowEditModal(true)
                },
              },
              {
                label: "Delete",
                icon: Trash2,
                variant: "destructive" as const,
                onClick: () => setPendingDeleteId(row.id),
              },
            ],
          },
        }}
        cardRenderer={(row) => (
          <div className="group bg-card text-card-foreground border-border/60 hover:border-primary/40 h-full space-y-3 rounded-xl border p-4 shadow-sm transition-all">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className="text-xs font-semibold capitalize">
                {row.feedback_type.replaceAll("_", " ")}
              </Badge>
              <Badge variant={row.status === "resolved" ? "default" : "outline"} className="capitalize">
                {row.status}
              </Badge>
            </div>
            <div>
              <h4 className="line-clamp-2 text-sm font-semibold">{row.title}</h4>
              {row.description && <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{row.description}</p>}
            </div>
            <div className="border-border/40 text-muted-foreground flex items-center justify-between border-t pt-2 text-xs">
              <span>Submitted</span>
              <span className="font-mono">{formatWATDate(row.created_at)}</span>
            </div>
          </div>
        )}
        expandable={{
          render: (row) => (
            <div className="bg-muted/20 space-y-3 rounded-lg border p-4 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
                  Feedback Description
                </span>
                <p className="bg-background rounded border p-2.5 leading-relaxed whitespace-pre-wrap">
                  {row.description || "No description provided."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
                    Category / Type
                  </span>
                  <span className="font-medium capitalize">{row.feedback_type.replaceAll("_", " ")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] font-semibold uppercase">Status</span>
                  <span className="font-medium capitalize">{row.status.replaceAll("_", " ")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] font-semibold uppercase">Submitted</span>
                  <span className="font-medium">{formatWATDate(row.created_at)}</span>
                </div>
              </div>

              <div className="flex gap-2 border-t pt-2.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    setSelectedFeedback(row)
                    setShowEditModal(true)
                  }}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit Feedback
                </Button>
              </div>
            </div>
          ),
        }}
        rowActions={[
          {
            label: "Edit",
            icon: Edit2,
            onClick: (item) => {
              setSelectedFeedback(item)
              setShowEditModal(true)
            },
          },
          {
            label: "Delete",
            icon: Trash2,
            variant: "destructive",
            onClick: (item) => setPendingDeleteId(item.id),
          },
        ]}
        emptyTitle="No feedback yet"
        emptyDescription="Submit your first feedback to get started."
        emptyIcon={MessageSquare}
        skeletonRows={5}
        urlSync
      />

      <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submit Feedback</DialogTitle>
            <DialogDescription>Share your thoughts with management.</DialogDescription>
          </DialogHeader>
          <FeedbackForm onFeedbackSubmitted={handleFeedbackSubmitted} variant="modal" />
        </DialogContent>
      </Dialog>

      {showEditModal && selectedFeedback ? (
        <FeedbackEditModal
          feedback={selectedFeedback}
          onClose={() => {
            setShowEditModal(false)
            setSelectedFeedback(null)
          }}
          onSave={(updatedFeedback) => {
            setUserFeedback((current) =>
              current.map((item) => (item.id === updatedFeedback.id ? updatedFeedback : item))
            )
            setShowEditModal(false)
            setSelectedFeedback(null)
          }}
        />
      ) : null}

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feedback</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this feedback? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingFeedback}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              loading={isDeletingFeedback}
              onClick={async () => {
                if (pendingDeleteId) {
                  setIsDeletingFeedback(true)
                  try {
                    await handleDelete(pendingDeleteId)
                    setPendingDeleteId(null)
                  } finally {
                    setIsDeletingFeedback(false)
                  }
                }
              }}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SystemSurveyModal
        isOpen={isSurveyModalOpen}
        onClose={() => setIsSurveyModalOpen(false)}
        existingSurvey={userSurvey}
        onSuccess={(updated) => setUserSurvey(updated)}
      />
    </DataTablePage>
  )
}
