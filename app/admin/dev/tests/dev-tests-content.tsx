"use client"

import { useEffect, useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FlaskConical, Route, Ticket, ClipboardList, Package } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader, PageWrapper } from "@/components/layout"
import { applyAssignableStatusFilter } from "@/lib/workforce/assignment-policy"
import { logger } from "@/lib/logger"
import { LeaveTab } from "./_components/LeaveTab"
import { HelpDeskTab } from "./_components/HelpDeskTab"
import { TaskTab } from "./_components/TaskTab"
import { AssetMailRoutingPanel } from "./_components/AssetMailRoutingPanel"

const log = logger("dev-tests")

// ── Root Content Component ────────────────────────────────────────────────────
export function DevTestsContent() {
  const supabase = createClient()
  const [employees, setEmployees] = useState<{ value: string; label: string }[]>([])
  const [leaveTypes, setLeaveTypes] = useState<{ value: string; label: string }[]>([])
  const [departments, setDepartments] = useState<string[]>([])

  const load = useCallback(async () => {
    const [profilesRes, typesRes, deptRes] = await Promise.all([
      applyAssignableStatusFilter(
        supabase.from("profiles").select("id, full_name, first_name, last_name, company_email").order("first_name"),
        { allowLegacyNullStatus: false }
      ),
      supabase.from("leave_types").select("id, name").order("name"),
      supabase.from("departments").select("name").order("name"),
    ])

    setEmployees(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (profilesRes.data || []).map((p: any) => ({
        value: p.id,
        label: p.full_name?.trim() || `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.company_email || p.id,
      }))
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setLeaveTypes((typesRes.data || []).map((t: any) => ({ value: t.id, label: t.name })))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setDepartments((deptRes.data || []).map((d: any) => d.name).filter(Boolean))
  }, [])

  useEffect(() => {
    load().catch((err) => log.error({ err: String(err) }, "load failed"))
  }, [load])

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Developer Tests"
        description="End-to-end flow tests for leave, help desk, task management, and asset routing"
        icon={FlaskConical}
        backLink={{ href: "/admin/dev", label: "Back to DEV" }}
      />

      <Tabs defaultValue="leave" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leave" className="gap-2">
            <Route className="h-4 w-4" />
            Leave
          </TabsTrigger>
          <TabsTrigger value="helpdesk" className="gap-2">
            <Ticket className="h-4 w-4" />
            Help Desk
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-2">
            <Package className="h-4 w-4" />
            Assets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leave">
          <LeaveTab employees={employees} leaveTypes={leaveTypes} />
        </TabsContent>

        <TabsContent value="helpdesk">
          <HelpDeskTab employees={employees} departments={departments} />
        </TabsContent>

        <TabsContent value="tasks">
          <TaskTab employees={employees} />
        </TabsContent>

        <TabsContent value="assets">
          <div className="space-y-4">
            <AssetMailRoutingPanel />
          </div>
        </TabsContent>
      </Tabs>
    </PageWrapper>
  )
}
