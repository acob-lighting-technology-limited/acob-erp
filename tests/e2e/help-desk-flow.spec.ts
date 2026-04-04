import { test, expect } from "@playwright/test"
import { seedTestData } from "./helpers/seed"
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
      request_type: "support",
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
  await employeeVerify.page.locator("select").selectOption("5")
  await employeeVerify.page.getByRole("button", { name: "Submit Rating" }).click()
  await expect(employeeVerify.page.getByText("Rating: 5/5")).toBeVisible()
  await closeSession(employeeVerify.context)
})
