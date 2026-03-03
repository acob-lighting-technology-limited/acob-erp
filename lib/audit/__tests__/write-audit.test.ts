import test from "node:test"
import assert from "node:assert/strict"
import { writeAuditLog } from "../write-audit"

test("writeAuditLog throws on critical audit failure", async () => {
  const supabase = {
    rpc: async () => ({ data: null, error: { message: "boom" } }),
  }

  await assert.rejects(() =>
    writeAuditLog(
      supabase as any,
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
  }

  const id = await writeAuditLog(
    supabase as any,
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
