import test from "node:test"
import assert from "node:assert/strict"
import type { SupabaseClient } from "@supabase/supabase-js"
import { writeAuditLog } from "../write-audit"

test("writeAuditLog throws on critical audit failure", async () => {
  const supabase = {
    rpc: async () => ({ data: null, error: { message: "boom" } }),
  } as unknown as Pick<SupabaseClient, "rpc"> as SupabaseClient

  await assert.rejects(() =>
    writeAuditLog(
      supabase,
      {
        action: "approve",
        entityType: "help_desk_ticket",
        entityId: "1",
        context: { source: "api", route: "/api/help-desk/tickets/[id]/approvals" },
      },
      { critical: true }
    )
  )
})

test("writeAuditLog fail-open returns null", async () => {
  const supabase = {
    rpc: async () => ({ data: null, error: { message: "boom" } }),
  } as unknown as Pick<SupabaseClient, "rpc"> as SupabaseClient

  const id = await writeAuditLog(
    supabase,
    {
      action: "create",
      entityType: "feedback",
      entityId: "1",
      context: { source: "ui", route: "/feedback" },
    },
    { failOpen: true }
  )

  assert.equal(id, null)
})
