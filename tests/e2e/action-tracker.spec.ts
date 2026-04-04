import { test, expect } from "@playwright/test"
import { seedTestData } from "./helpers/seed"
import { closeSession, createLoggedInSession, expectApiOk, previousOfficeWeek, uniqueLabel } from "./helpers/session"

test("Action tracker with carry-forward", async ({ browser }) => {
  const seed = await seedTestData()
  test.skip(!seed.ready || !seed.actionDepartment, seed.reason || "Action tracker seed data not ready")

  const unique = uniqueLabel("Playwright action")
  const previousWeek = previousOfficeWeek()

  const admin = await createLoggedInSession(browser, seed.testAdmin)
  const createResponse = await admin.page.request.post("/api/reports/action-tracker", {
    data: {
      title: unique,
      description: `${unique} description`,
      department: seed.actionDepartment,
      week_number: previousWeek.week,
      year: previousWeek.year,
    },
  })
  await expectApiOk(createResponse, "create previous-week action item")

  await admin.page.goto("/admin/reports/action-tracker")
  await expect(admin.page.getByRole("button", { name: "Carry Forward" })).toBeVisible()
  await admin.page.getByRole("button", { name: "Carry Forward" }).click()
  await expect(admin.page.getByText(/Carried forward/i)).toBeVisible()
  await admin.page.getByPlaceholder("Search by description or department...").fill(unique)
  await expect(admin.page.getByText(unique)).toBeVisible()
  await closeSession(admin.context)
})
