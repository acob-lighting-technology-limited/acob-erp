import { test, expect } from "@playwright/test"
import { seedTestData } from "./helpers/seed"
import { toLocalISODate } from "@/lib/utils/date"
import { closeSession, createLoggedInSession, expectApiOk, uniqueLabel } from "./helpers/session"

test("Help desk ticket lifecycle", async ({ browser }) => {
  const seed = await seedTestData()
  test.skip(
    !seed.ready || !seed.helpDeskDepartment || !seed.testITStaff.id,
    seed.reason || "Help desk seed data not ready"
  )

  const unique = uniqueLabel("Playwright help desk")

  const employee = await createLoggedInSession(browser, seed.testEmployee)
  const createResponse = await employee.page.request.post("/api/help-desk/tickets", {
    data: {
      title: unique,
      description: `${unique} description`,
      service_department: seed.helpDeskDepartment,
      priority: "medium",
    },
  })
  await expectApiOk(createResponse, "create help desk ticket")
  const created = (await createResponse.json()) as { data?: { id?: string } }
  const ticketId = created.data?.id
  expect(ticketId).toBeTruthy()

  await employee.page.goto("/help-desk")
  await expect(employee.page.getByText(unique)).toBeVisible()
  await closeSession(employee.context)

  const lead = await createLoggedInSession(browser, seed.testLead)
  const assignResponse = await lead.page.request.patch(`/api/help-desk/tickets/${ticketId}/assign`, {
    data: {
      assigned_to: seed.testITStaff.id,
    },
  })
  await expectApiOk(assignResponse, "assign help desk ticket")
  await closeSession(lead.context)

  const itStaff = await createLoggedInSession(browser, seed.testITStaff)
  await itStaff.page.goto("/help-desk")
  const ticketRow = itStaff.page.locator("tr").filter({ hasText: unique }).first()
  await expect(ticketRow).toBeVisible()
  await ticketRow.getByRole("button", { name: "Start" }).click()
  await expect(ticketRow.getByRole("button", { name: "Resolve" })).toBeVisible()
  await ticketRow.getByRole("button", { name: "Resolve" }).click()
  await closeSession(itStaff.context)

  const employeeVerify = await createLoggedInSession(browser, seed.testEmployee)
  await employeeVerify.page.goto(`/help-desk/${ticketId}`)
  await expect(employeeVerify.page.getByText(unique)).toBeVisible()
  await employeeVerify.page.getByRole("button", { name: "5", exact: true }).click()
  await employeeVerify.page.getByRole("button", { name: "Close Ticket with Rating" }).click()
  await expect(employeeVerify.page.getByText("Rating: 5/5")).toBeVisible()
  await closeSession(employeeVerify.context)
})

test("Help desk ticket convert to task", async ({ browser }) => {
  const seed = await seedTestData()
  test.skip(
    !seed.ready || !seed.helpDeskDepartment || !seed.testITStaff.id,
    seed.reason || "Help desk seed data not ready"
  )

  const unique = uniqueLabel("Playwright convert ticket")

  const employee = await createLoggedInSession(browser, seed.testEmployee)
  const createResponse = await employee.page.request.post("/api/help-desk/tickets", {
    data: {
      title: unique,
      description: `${unique} description for task conversion`,
      service_department: seed.helpDeskDepartment,
      priority: "medium",
    },
  })
  await expectApiOk(createResponse, "create ticket for conversion")
  const created = (await createResponse.json()) as { data?: { id?: string } }
  const ticketId = created.data?.id
  expect(ticketId).toBeTruthy()
  await closeSession(employee.context)

  const lead = await createLoggedInSession(browser, seed.testLead)
  const convertResponse = await lead.page.request.post(`/api/help-desk/tickets/${ticketId}/convert-to-task`, {
    data: {
      title: `${unique} Task`,
      department: seed.helpDeskDepartment,
      assigned_to: seed.testITStaff.id,
      weight: 3,
      priority: "medium",
      due_date: toLocalISODate(new Date(Date.now() + 86400000)),
    },
  })
  await expectApiOk(convertResponse, "convert ticket to task")
  const converted = (await convertResponse.json()) as { data?: { task_id?: string; ticket_id?: string } }
  expect(converted.data?.task_id).toBeTruthy()
  expect(converted.data?.ticket_id).toBe(ticketId)
  await closeSession(lead.context)
})
