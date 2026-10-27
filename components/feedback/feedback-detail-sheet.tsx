"use client"

import { DetailList, SectionHeading } from "@/components/ui/detail-list"
import { DetailSheet } from "@/components/ui/detail-sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatName } from "@/lib/utils"
import { formatWATDate, formatWATDateTime } from "@/lib/utils/date"
import type { FeedbackRecord } from "@/components/feedback/types"

function getTypeColor(type: string): string {
  switch (type) {
    case "concern":
      return "bg-warning/15 text-warning"
    case "complaint":
      return "bg-danger/15 text-danger"
    case "suggestion":
      return "bg-info/15 text-info"
    case "required_item":
      return "bg-purple/15 text-purple"
    default:
      return "bg-muted text-foreground"
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "open":
      return "bg-success/15 text-success"
    case "in_progress":
      return "bg-info/15 text-info"
    case "resolved":
      return "bg-purple/15 text-purple"
    case "closed":
      return "bg-muted text-foreground"
    default:
      return "bg-muted text-foreground"
  }
}

interface FeedbackDetailSheetProps {
  feedback: FeedbackRecord | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onUpdateStatus: (newStatus: string) => void
  isUpdating: boolean
}

export function FeedbackDetailSheet({
  feedback,
  isOpen,
  onOpenChange,
  onUpdateStatus,
  isUpdating,
}: FeedbackDetailSheetProps) {
  const submitter = feedback?.user_id
    ? `${formatName(feedback.profiles?.first_name)} ${formatName(feedback.profiles?.last_name)}`
    : "Anonymous submission"
  return (
    <DetailSheet
      open={isOpen}
      onOpenChange={onOpenChange}
      title={feedback?.title ?? "Feedback"}
      description={feedback ? submitter : undefined}
      badges={
        feedback ? (
          <>
            <Badge className={getTypeColor(feedback.feedback_type)}>{feedback.feedback_type}</Badge>
            <Badge className={getStatusColor(feedback.status)}>{feedback.status}</Badge>
          </>
        ) : null
      }
      footer={
        <Button onClick={() => onOpenChange(false)} variant="outline" size="sm" className="ml-auto">
          Close
        </Button>
      }
    >
      {feedback && (
        <>
          {feedback.target_lead_id && (
            <div className="space-y-2">
              <SectionHeading title="Feedback about (department lead)" />
              <p className="text-sm font-medium">
                {formatName(feedback.target_lead?.first_name)} {formatName(feedback.target_lead?.last_name)}
                <span className="text-muted-foreground font-normal">
                  {" "}
                  · {feedback.target_department || feedback.target_lead?.department || "—"}
                </span>
              </p>
              <p className="text-muted-foreground text-xs">
                Fully anonymous upward feedback. The submitter is not recorded anywhere, and this record is never shown
                to the lead named above.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <SectionHeading title="Submitted by" />
            <DetailList
              items={[
                { label: "Name", value: feedback.user_id ? submitter : "Anonymous submission" },
                { label: "Email", value: feedback.user_id ? feedback.profiles?.company_email : null },
                { label: "Department", value: feedback.user_id ? feedback.profiles?.department : null },
                // Lead feedback is stamped to the day only — a clock time would imply a precision that is deliberately not recorded.
                {
                  label: "Submitted",
                  value: feedback.target_lead_id
                    ? `${formatWATDate(feedback.created_at)} (date only)`
                    : formatWATDateTime(feedback.created_at),
                },
                ...(feedback.updated_at !== feedback.created_at
                  ? [{ label: "Updated", value: formatWATDateTime(feedback.updated_at) }]
                  : []),
              ]}
            />
          </div>

          <div className="space-y-2">
            <SectionHeading title="Description" />
            <p className="text-sm whitespace-pre-wrap">{feedback.description || "No description provided."}</p>
          </div>

          <div className="space-y-2">
            <SectionHeading title="Update status" />
            <Select value={feedback.status} onValueChange={(value) => onUpdateStatus(value)} disabled={isUpdating}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </DetailSheet>
  )
}
