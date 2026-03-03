import test from "node:test"
import assert from "node:assert/strict"
import { buildAuditRpcParams, isCriticalAuditAction, normalizeAuditAction } from "../core"

test("normalizeAuditAction maps legacy event names", () => {
  const normalized = normalizeAuditAction("help_desk_ticket_assigned")
  assert.equal(normalized.action, "assign")
  assert.equal(normalized.event, "help_desk_ticket_assigned")
})

test("buildAuditRpcParams enriches metadata and validates required fields", () => {
  const params = buildAuditRpcParams({
    action: "help_desk_ticket_updated",
    entityType: "help_desk_ticket",
    entityId: "ticket-123",
    context: {
      actorId: "user-1",
      source: "api",
      route: "/api/help-desk/tickets/[id]",
      requestId: "req-1",
    },
  })

  assert.equal(params.p_action, "update")
  assert.equal(params.p_entity_type, "help_desk_ticket")
  assert.equal(params.p_entity_id, "ticket-123")
  assert.equal((params.p_metadata as Record<string, unknown>).source, "api")
  assert.equal((params.p_metadata as Record<string, unknown>).route, "/api/help-desk/tickets/[id]")
  assert.equal((params.p_metadata as Record<string, unknown>).request_id, "req-1")
  assert.equal((params.p_metadata as Record<string, unknown>).event, "help_desk_ticket_updated")
})

test("isCriticalAuditAction marks critical workflows", () => {
  assert.equal(isCriticalAuditAction("approve"), true)
  assert.equal(isCriticalAuditAction("assign"), true)
  assert.equal(isCriticalAuditAction("status_change"), true)
  assert.equal(isCriticalAuditAction("create"), false)
})
