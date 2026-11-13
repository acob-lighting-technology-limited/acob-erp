import { test } from "node:test"
import assert from "node:assert/strict"
import { buildAssetActivities, type AssetHistoryPayload } from "../asset-activity"

const ASSET = "a1"

function payload(overrides: Partial<AssetHistoryPayload> = {}): AssetHistoryPayload {
  return {
    assets: [
      {
        id: ASSET,
        unique_code: "ACOB/LT/001",
        asset_type: "LT",
        asset_model: "Dell Latitude 3500",
        created_at: "2025-10-01T09:00:00+00:00",
        created_by: "u-admin",
        deleted_at: null,
        deleted_by: null,
        delete_reason: null,
      },
    ],
    assignments: [
      {
        id: "as1",
        asset_id: ASSET,
        assigned_at: "2025-10-03T10:00:00+00:00",
        handed_over_at: "2025-11-02T10:00:00+00:00",
        assignment_notes: "New starter",
        handover_notes: "Returned in good condition",
        assigned_by: "u-admin",
        assigned_to: "u-farouk",
        department: null,
        office_location: null,
        assignment_type: "individual",
        acceptance_status: "not_required",
        accepted_at: null,
      },
    ],
    issues: [],
    reports: [],
    statusChanges: [
      // Echo of the assignment two minutes later: hidden.
      {
        id: "s1",
        asset_id: ASSET,
        created_at: "2025-10-03T10:02:00+00:00",
        user_id: "u-admin",
        old_status: "available",
        new_status: "assigned",
      },
      // Echo of the return: hidden.
      {
        id: "s2",
        asset_id: ASSET,
        created_at: "2025-11-02T10:01:00+00:00",
        user_id: "u-admin",
        old_status: "assigned",
        new_status: "available",
      },
      // A real change on its own: kept.
      {
        id: "s3",
        asset_id: ASSET,
        created_at: "2025-12-01T10:00:00+00:00",
        user_id: "u-admin",
        old_status: "available",
        new_status: "maintenance",
      },
    ],
    users: [
      { id: "u-admin", first_name: "Farouk", last_name: "Mustapha" },
      { id: "u-farouk", first_name: "ada", last_name: "obi" },
    ],
    ...overrides,
  }
}

test("builds added, assigned, returned and real status changes, newest first", () => {
  const activities = buildAssetActivities(payload())
  assert.deepEqual(
    activities.map((a) => a.type),
    ["status_change", "unassignment", "assignment", "created"]
  )
  assert.equal(activities[0].details?.status, "maintenance")
})

test("names the holder and who did it", () => {
  const [, returned, assigned, created] = buildAssetActivities(payload())
  assert.equal(assigned.title, "Assigned to Ada Obi")
  assert.equal(assigned.performed_by_name, "Farouk Mustapha")
  assert.equal(assigned.details?.notes, "New starter")
  assert.equal(returned.title, "Returned by Ada Obi")
  assert.equal(returned.details?.held_days, 30)
  assert.equal(created.performed_by_name, "Farouk Mustapha")
})

test("acceptance, an automatic acceptance and a staff report each become an event", () => {
  const base = payload()
  const activities = buildAssetActivities({
    ...base,
    assignments: [
      { ...base.assignments[0], acceptance_status: "accepted", accepted_at: "2025-10-04T09:00:00+00:00" },
      {
        ...base.assignments[0],
        id: "as2",
        assigned_at: "2025-12-02T10:00:00+00:00",
        handed_over_at: null,
        acceptance_status: "auto_accepted",
        accepted_at: "2025-12-08T07:20:00+00:00",
      },
    ],
    reports: [
      {
        id: "r1",
        asset_id: ASSET,
        reported_by: "u-farouk",
        kind: "already_returned",
        note: "Handed to IT on 3 Nov",
        status: "resolved",
        resolution_note: "Confirmed",
        released: true,
        resolved_by: "u-admin",
        resolved_at: "2025-12-10T10:00:00+00:00",
        created_at: "2025-12-09T10:00:00+00:00",
      },
    ],
  })
  const titles = activities.map((a) => a.title)
  assert.ok(titles.includes("Receipt confirmed by Ada Obi"))
  assert.ok(titles.includes("Accepted automatically"))
  assert.ok(titles.includes("Ada Obi reported: I already returned it"))
  assert.ok(titles.includes("Report resolved, asset released: I already returned it"))
})

test("a status change to assigned with no assignment nearby is kept", () => {
  const activities = buildAssetActivities(
    payload({
      assignments: [],
      statusChanges: [
        {
          id: "s9",
          asset_id: ASSET,
          created_at: "2026-01-05T10:00:00+00:00",
          user_id: null,
          old_status: "available",
          new_status: "assigned",
        },
      ],
    })
  )
  assert.ok(activities.some((a) => a.id === "s9"))
})

test("an office assignment falls back to the office name, and archiving is an event", () => {
  const base = payload()
  const activities = buildAssetActivities({
    ...base,
    assets: [{ ...base.assets[0], deleted_at: "2026-02-01T00:00:00+00:00", delete_reason: "Damaged beyond repair" }],
    assignments: [{ ...base.assignments[0], assigned_to: null, office_location: "Server Room", handed_over_at: null }],
    statusChanges: [],
  })
  const archived = activities.find((a) => a.type === "archived")
  assert.equal(archived?.description, "Damaged beyond repair")
  assert.equal(activities.find((a) => a.type === "assignment")?.title, "Assigned to Server Room")
  assert.ok(!activities.some((a) => a.type === "unassignment"))
})
