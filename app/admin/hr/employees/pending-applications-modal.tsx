"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Loader2, CheckCircle, UserPlus, ChevronRight, ShieldCheck, Hash } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn, formatName, formatFullName } from "@/lib/utils"

interface PendingUser {
  id: string
  first_name: string
  last_name: string
  other_names?: string
  department: string
  company_role: string
  company_email: string
  personal_email: string
  phone_number: string
  residential_address: string
  current_work_location: string
  office_location?: string
  created_at: string
  status: string
}

interface PendingApplicationsModalProps {
  onEmployeeCreated: () => void
}

export function PendingApplicationsModal({ onEmployeeCreated }: PendingApplicationsModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [employeeId, setEmployeeId] = useState("")
  const [hireDate, setHireDate] = useState(new Date().toISOString().split("T")[0])

  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      fetchPendingUsers()
    }
  }, [isOpen])

  const fetchPendingUsers = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from("pending_users")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (error) throw error
      setPendingUsers(data || [])
      if (data && data.length > 0 && !selectedUser) {
        handleUserSelect(data[0])
      }
    } catch (error: any) {
      console.error("Error fetching pending users:", error)
      toast.error("Failed to load pending applications")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSuggestedId = async () => {
    try {
      const { data: lastProfile } = await supabase
        .from("profiles")
        .select("employee_number")
        .not("employee_number", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      let nextIdNumber = 1
      const currentYear = new Date().getFullYear()

      if (lastProfile && lastProfile.employee_number) {
        const parts = lastProfile.employee_number.split("/")
        if (parts.length === 3) {
          const lastNum = parseInt(parts[2], 10)
          if (!isNaN(lastNum)) {
            nextIdNumber = lastNum + 1
          }
        }
      }
      setEmployeeId(`ACOB/${currentYear}/${nextIdNumber.toString().padStart(3, "0")}`)
    } catch (err) {
      console.error("Error suggesting ID:", err)
      setEmployeeId(`ACOB/${new Date().getFullYear()}/001`)
    }
  }

  const handleUserSelect = (user: PendingUser) => {
    setSelectedUser(user)
    fetchSuggestedId()
  }

  const handleApprove = async () => {
    if (!selectedUser) return
    setIsProcessing(true)

    try {
      const response = await fetch("/api/admin/approve-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendingUserId: selectedUser.id,
          employeeId: employeeId,
          hireDate: hireDate,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to approve user")
      }

      toast.success("User approved and account created successfully")
      const remaining = pendingUsers.filter((u) => u.id !== selectedUser.id)
      setPendingUsers(remaining)
      setSelectedUser(remaining.length > 0 ? remaining[0] : null)
      onEmployeeCreated()
    } catch (error: any) {
      console.error("Approval error:", error)
      toast.error(error.message || "Failed to approve user")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedUser) return
    if (!confirm("Are you sure you want to reject this application? This cannot be undone.")) return

    setIsProcessing(true)
    try {
      const { error } = await supabase.from("pending_users").delete().eq("id", selectedUser.id)

      if (error) throw error

      toast.success("Application rejected")
      const remaining = pendingUsers.filter((u) => u.id !== selectedUser.id)
      setPendingUsers(remaining)
      setSelectedUser(remaining.length > 0 ? remaining[0] : null)
    } catch (error: any) {
      console.error("Rejection error:", error)
      toast.error("Failed to reject application")
    } finally {
      setIsProcessing(false)
    }
  }

  const DetailRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div className="border-border hover:bg-muted/50 grid grid-cols-4 border-b transition-colors">
      <div className="border-border bg-muted/40 flex items-center border-r p-3">
        <span className="text-muted-foreground text-xs font-bold uppercase">{label}</span>
      </div>
      <div className="bg-background col-span-3 flex items-center p-3">
        <span className="text-foreground text-sm font-medium">{value || "—"}</span>
      </div>
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-9 gap-2">
          <UserPlus className="h-4 w-4" />
          Review Applications
          {pendingUsers.length > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
              {pendingUsers.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-background text-foreground flex h-[85vh] max-w-6xl flex-col overflow-hidden p-0 font-sans shadow-2xl">
        <div className="sr-only">
          <DialogTitle>Pending Onboarding Applications</DialogTitle>
          <DialogDescription>Review and approve system access for new employees.</DialogDescription>
        </div>
        <div className="flex min-h-0 flex-1">
          {/* List Column (Standard Sidebar) */}
          <aside className="border-border bg-muted/10 flex w-[300px] flex-col border-r">
            <div className="border-border bg-background border-b p-6">
              <h2 className="text-lg font-bold tracking-tight">Queue</h2>
              <p className="text-muted-foreground text-xs font-medium">Verification Needed</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="divide-border divide-y">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center gap-4 p-12 opacity-50">
                    <Loader2 className="text-primary h-6 w-6 animate-spin" />
                    <p className="text-xs font-medium">Loading...</p>
                  </div>
                ) : pendingUsers.length === 0 ? (
                  <div className="space-y-3 p-12 text-center opacity-40">
                    <CheckCircle className="mx-auto h-8 w-8" />
                    <p className="text-xs font-medium">Queue is empty</p>
                  </div>
                ) : (
                  pendingUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      className={cn(
                        "group relative flex w-full items-center justify-between px-6 py-4 text-left transition-all",
                        selectedUser?.id === user.id
                          ? "bg-muted border-l-primary border-l-4 shadow-sm"
                          : "hover:bg-muted/50 border-l-4 border-l-transparent"
                      )}
                    >
                      <div className="min-w-0">
                        <div
                          className={cn(
                            "truncate text-sm font-bold transition-colors",
                            selectedUser?.id === user.id ? "text-primary" : "text-foreground"
                          )}
                        >
                          {formatName(user.first_name)} {formatName(user.last_name)}
                        </div>
                        <div className="text-muted-foreground mt-1 text-[11px] font-medium">
                          Applied {format(new Date(user.created_at), "MMM d, yyyy")}
                        </div>
                      </div>
                      <ChevronRight
                        className={cn(
                          "h-3 w-3 transition-transform",
                          selectedUser?.id === user.id ? "text-primary translate-x-1" : "text-muted-foreground/30"
                        )}
                      />
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </aside>

          {/* Content Column (Standard Details) */}
          <main className="bg-background relative flex flex-1 flex-col">
            {selectedUser ? (
              <>
                <ScrollArea className="flex-1">
                  <div className="max-w-4xl p-10 pb-32">
                    <div className="mb-6 flex items-center justify-between">
                      <h2 className="text-xl font-bold tracking-tight">Applicant Verification Profile</h2>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                          <span className="text-muted-foreground mb-1 text-[10px] font-bold uppercase">Hire Date</span>
                          <Input
                            type="date"
                            value={hireDate}
                            onChange={(e) => setHireDate(e.target.value)}
                            className="bg-primary/5 border-primary/20 focus-visible:ring-primary h-9 w-40 font-mono text-xs font-bold"
                          />
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-muted-foreground mb-1 text-[10px] font-bold uppercase">Assign ID</span>
                          <div className="relative w-44">
                            <Hash className="text-primary absolute top-2.5 left-2.5 h-3.5 w-3.5" />
                            <Input
                              value={employeeId}
                              onChange={(e) => setEmployeeId(e.target.value)}
                              className="bg-primary/5 border-primary/20 focus-visible:ring-primary h-9 pl-8 font-mono text-xs font-bold"
                              placeholder="ACOB/2026/001"
                            />
                          </div>
                        </div>
                        <Badge variant="outline" className="mb-1 self-end py-0.5 text-[10px] font-bold">
                          PENDING APPROVAL
                        </Badge>
                      </div>
                    </div>

                    {/* Table Grid with full borders */}
                    <div className="border-border overflow-hidden rounded-lg border shadow-sm">
                      <DetailRow label="First Name" value={formatName(selectedUser.first_name)} />
                      <DetailRow label="Last Name" value={formatName(selectedUser.last_name)} />
                      <DetailRow label="Other Names" value={formatName(selectedUser.other_names)} />
                      <div className="border-border grid grid-cols-1 border-b">
                        <div className="bg-muted/20 text-muted-foreground border-border border-b p-2 text-[10px] font-bold uppercase">
                          Organizational Data
                        </div>
                        <div className="grid grid-cols-1">
                          <DetailRow label="Department" value={selectedUser.department} />
                          <DetailRow label="Company Role" value={selectedUser.company_role} />
                          <DetailRow label="System Email" value={selectedUser.company_email} />
                          <DetailRow label="Assigned ID" value={employeeId} />
                          <DetailRow label="Base Location" value={selectedUser.current_work_location} />
                          <DetailRow label="Specific Unit" value={selectedUser.office_location || "Office"} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1">
                        <div className="bg-muted/20 text-muted-foreground border-border border-b p-2 text-[10px] font-bold uppercase">
                          Personal & Contact
                        </div>
                        <div className="grid grid-cols-1">
                          <DetailRow label="Phone Number" value={selectedUser.phone_number} />
                          <DetailRow label="Personal Email" value={selectedUser.personal_email} />
                          <DetailRow label="Address" value={selectedUser.residential_address} />
                          <DetailRow
                            label="Application Date"
                            value={format(new Date(selectedUser.created_at), "PPPP")}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/40 border-border mt-10 flex items-start gap-4 rounded-lg border p-5">
                      <ShieldCheck className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold">Admin Notice</p>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Ensure all data fields match official documentation. Approval will automatically update the HR
                          database and broadcast welcome emails.
                        </p>
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                {/* Fixed Footer Actions */}
                <div className="bg-background border-border absolute right-0 bottom-0 left-0 z-10 flex justify-end gap-3 border-t p-6">
                  <Button
                    variant="outline"
                    onClick={handleReject}
                    disabled={isProcessing}
                    className="h-10 px-6 font-semibold"
                  >
                    {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reject Candidate"}
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={isProcessing}
                    className="bg-primary h-10 px-10 font-bold shadow-sm"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Processing
                      </>
                    ) : (
                      "Confirm & Approve"
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-12 text-center opacity-30">
                <UserPlus className="mb-4 h-10 w-10" />
                <h3 className="text-sm font-medium">Select an application from the queue</h3>
              </div>
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
