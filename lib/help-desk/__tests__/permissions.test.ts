import { test } from "node:test"
import assert from "node:assert/strict"
import {
  canAcceptTicket,
  canCancelTicket,
  canCloseTicket,
  canConvertToTask,
  canLeadDepartment,
  canPauseWork,
  canReassignTicket,
  canResolveTicket,
  canStartWork,
  canViewTicket,
  canWorkDepartment,
  isAdminRole,
  type HelpDeskTicketContext,
  type HelpDeskUserContext,
} from "../permissions"

const adminUser: HelpDeskUserContext = {
  id: "user-admin",
  role: "admin",
  department: "Executive Management",
  is_department_lead: false,
}

const itLead: HelpDeskUserContext = {
  id: "user-it-lead",
  role: "employee",
  department: "IT and Communications",
  is_department_lead: true,
  lead_departments: ["IT and Communications"],
}

const itStaff: HelpDeskUserContext = {
  id: "user-it-staff",
  role: "employee",
  department: "IT and Communications",
  is_department_lead: false,
}

const requesterUser: HelpDeskUserContext = {
  id: "user-requester",
  role: "employee",
  department: "Accounts",
  is_department_lead: false,
}

const accountsLead: HelpDeskUserContext = {
  id: "user-accounts-lead",
  role: "employee",
  department: "Accounts",
  is_department_lead: true,
  lead_departments: ["Accounts"],
}

const baseTicket: HelpDeskTicketContext = {
  id: "ticket-1",
  requester_id: requesterUser.id ?? "user-requester",
  requester_department: "Accounts",
  assigned_to: itStaff.id ?? "user-it-staff",
  service_department: "IT and Communications",
  status: "assigned",
}

test("role and department checks", () => {
  assert.equal(isAdminRole("admin"), true)
  assert.equal(isAdminRole("developer"), true)
  assert.equal(isAdminRole("super_admin"), true)
  assert.equal(isAdminRole("employee"), false)
  assert.equal(isAdminRole(null), false)

  assert.equal(canLeadDepartment(itLead, "IT and Communications"), true)
  assert.equal(canLeadDepartment(itLead, "Accounts"), false)
  assert.equal(canLeadDepartment(itStaff, "IT and Communications"), false)
  assert.equal(canLeadDepartment(null, "IT and Communications"), false)

  assert.equal(canWorkDepartment(itStaff, "IT and Communications"), true)
  assert.equal(canWorkDepartment(itLead, "IT and Communications"), true)
  assert.equal(canWorkDepartment(requesterUser, "IT and Communications"), false)
})

test("canViewTicket visibility rules", () => {
  assert.equal(canViewTicket(adminUser, baseTicket), true)
  assert.equal(canViewTicket(requesterUser, baseTicket), true)
  assert.equal(canViewTicket(itStaff, baseTicket), true)
  assert.equal(canViewTicket(itLead, baseTicket), true)
  assert.equal(canViewTicket(accountsLead, baseTicket), true)

  const otherStaff: HelpDeskUserContext = {
    id: "user-other",
    role: "employee",
    department: "Logistics",
    is_department_lead: false,
  }
  assert.equal(canViewTicket(otherStaff, baseTicket), false)
})

test("canReassignTicket and canAcceptTicket allow lead and admin across open statuses", () => {
  for (const status of ["new", "department_queue", "assigned", "in_progress", "paused"]) {
    const t = { ...baseTicket, status }
    assert.equal(canReassignTicket(itLead, t), true, `lead should reassign in ${status}`)
    assert.equal(canAcceptTicket(adminUser, t), true, `admin should accept in ${status}`)
    assert.equal(canReassignTicket(itStaff, t), false, `assignee cannot reassign in ${status}`)
    assert.equal(canReassignTicket(requesterUser, t), false, `requester cannot reassign in ${status}`)
  }

  for (const status of ["resolved", "closed", "cancelled", "rejected", "converted"]) {
    const t = { ...baseTicket, status }
    assert.equal(canReassignTicket(itLead, t), false, `lead cannot reassign terminal status ${status}`)
    assert.equal(canReassignTicket(adminUser, t), false, `admin cannot reassign terminal status ${status}`)
  }
})

test("canStartWork and canPauseWork lifecycle checks", () => {
  const assigned = { ...baseTicket, status: "assigned" }
  assert.equal(canStartWork(itStaff, assigned), true)
  assert.equal(canStartWork(itLead, assigned), true)
  assert.equal(canStartWork(adminUser, assigned), true)
  assert.equal(canStartWork(requesterUser, assigned), false)

  const inProgress = { ...baseTicket, status: "in_progress" }
  assert.equal(canStartWork(itStaff, inProgress), false)
  assert.equal(canPauseWork(itStaff, inProgress), true)
  assert.equal(canPauseWork(itLead, inProgress), true)
  assert.equal(canPauseWork(adminUser, inProgress), true)
  assert.equal(canPauseWork(requesterUser, inProgress), false)

  const paused = { ...baseTicket, status: "paused" }
  assert.equal(canStartWork(itStaff, paused), true)
  assert.equal(canPauseWork(itStaff, paused), false)
})

test("canResolveTicket rules", () => {
  for (const status of ["assigned", "in_progress", "paused"]) {
    const t = { ...baseTicket, status }
    assert.equal(canResolveTicket(itStaff, t), true)
    assert.equal(canResolveTicket(itLead, t), true)
    assert.equal(canResolveTicket(adminUser, t), true)
    assert.equal(canResolveTicket(requesterUser, t), false)
  }

  const resolved = { ...baseTicket, status: "resolved" }
  assert.equal(canResolveTicket(itStaff, resolved), false)
})

test("canCloseTicket strictly blocks assignee and requires resolved status", () => {
  const resolvedTicket = { ...baseTicket, status: "resolved" }

  // Requester, receiving lead, global admin can close
  assert.equal(canCloseTicket(requesterUser, resolvedTicket), true)
  assert.equal(canCloseTicket(itLead, resolvedTicket), true)
  assert.equal(canCloseTicket(adminUser, resolvedTicket), true)

  // ASSIGNEE CAN NEVER CLOSE OR RATE THEIR OWN TICKET
  assert.equal(canCloseTicket(itStaff, resolvedTicket), false)

  // Even if the assignee is also the department lead or an admin, assignee cannot self-close
  const selfAssignedLeadTicket: HelpDeskTicketContext = {
    ...baseTicket,
    assigned_to: itLead.id,
    status: "resolved",
  }
  assert.equal(canCloseTicket(itLead, selfAssignedLeadTicket), false)

  // Ticket must be in resolved status to close
  const inProgressTicket = { ...baseTicket, status: "in_progress" }
  assert.equal(canCloseTicket(requesterUser, inProgressTicket), false)
  assert.equal(canCloseTicket(itLead, inProgressTicket), false)

  // Closed ticket cannot be closed again
  const closedTicket = { ...baseTicket, status: "closed" }
  assert.equal(canCloseTicket(requesterUser, closedTicket), false)
})

test("canConvertToTask rules", () => {
  const openTicket = { ...baseTicket, status: "in_progress" }
  assert.equal(canConvertToTask(itLead, openTicket), true)
  assert.equal(canConvertToTask(adminUser, openTicket), true)
  assert.equal(canConvertToTask(itStaff, openTicket), false)
  assert.equal(canConvertToTask(requesterUser, openTicket), false)

  const convertedTicket = { ...baseTicket, status: "converted" }
  assert.equal(canConvertToTask(itLead, convertedTicket), false)

  const closedTicket = { ...baseTicket, status: "closed" }
  assert.equal(canConvertToTask(itLead, closedTicket), false)
})

test("canCancelTicket before work starts vs lead power", () => {
  const newTicket = { ...baseTicket, status: "new" }
  assert.equal(canCancelTicket(requesterUser, newTicket), true)
  assert.equal(canCancelTicket(itLead, newTicket), true)

  const assignedTicket = { ...baseTicket, status: "assigned" }
  assert.equal(canCancelTicket(requesterUser, assignedTicket), true)
  assert.equal(canCancelTicket(itLead, assignedTicket), true)

  const inProgressTicket = { ...baseTicket, status: "in_progress" }
  // Requester CANNOT cancel after work has started
  assert.equal(canCancelTicket(requesterUser, inProgressTicket), false)
  // Lead CAN cancel open ticket
  assert.equal(canCancelTicket(itLead, inProgressTicket), true)
  assert.equal(canCancelTicket(adminUser, inProgressTicket), true)

  const resolvedTicket = { ...baseTicket, status: "resolved" }
  assert.equal(canCancelTicket(requesterUser, resolvedTicket), false)
  assert.equal(canCancelTicket(itLead, resolvedTicket), false)
})
