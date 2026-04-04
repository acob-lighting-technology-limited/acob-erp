import { test, expect } from "@playwright/test"
import { getSeedAdminClient, seedTestData } from "./helpers/seed"
import { closeSession, createLoggedInSession, expectApiOk, futureIsoDate, uniqueLabel } from "./helpers/session"

test("KPI to Task to Review pipeline", async ({ browser }) => {
  const seed = await seedTestData()
  const adminClient = getSeedAdminClient()
  test.skip(
    !seed.ready || !seed.reviewCycleId || !seed.testEmployee.id || !adminClient,
    seed.reason || "Performance seed data not ready"
  )
  if (!adminClient) {
    return
  }

  const goalTitle = uniqueLabel("Playwright KPI")
  const taskTitle = `${goalTitle} task`

  const employee = await createLoggedInSession(browser, seed.testEmployee)
  await employee.page.goto("/goals")
  await employee.page.getByRole("button", { name: "Add Goal" }).click()
  await employee.page.locator("#title").fill(goalTitle)
  await employee.page.locator("textarea").fill(`${goalTitle} description`)
  await employee.page.locator('input[type="date"]').fill(futureIsoDate(30))
  await employee.page.getByRole("button", { name: "Create Goal" }).click()
  const goalCard = employee.page.locator("div").filter({ hasText: goalTitle }).first()
  await expect(goalCard).toBeVisible()
  await goalCard.getByRole("button", { name: "Request KPI Approval" }).click()

  const goalResponse = await employee.page.request.get(`/api/hr/performance/goals?user_id=${seed.testEmployee.id}`)
  await expectApiOk(goalResponse, "fetch employee goals")
  const goalPayload = (await goalResponse.json()) as { data?: Array<{ id: string; title: string }> }
  const goal = goalPayload.data?.find((item) => item.title === goalTitle)
  expect(goal?.id).toBeTruthy()
  await closeSession(employee.context)

  const lead = await createLoggedInSession(browser, seed.testLead)
  const approveGoalResponse = await lead.page.request.patch("/api/hr/performance/goals", {
    data: { id: goal!.id, approval_status: "approved" },
  })
  await expectApiOk(approveGoalResponse, "approve goal")
  await closeSession(lead.context)

  const admin = await createLoggedInSession(browser, seed.testAdmin)
  const taskResponse = await admin.page.request.post("/api/tasks", {
    data: {
      title: taskTitle,
      description: `${taskTitle} description`,
      priority: "high",
      status: "pending",
      due_date: futureIsoDate(14),
      department: seed.testEmployee.department || null,
      assignment_type: "individual",
      assigned_to: seed.testEmployee.id,
      goal_id: goal!.id,
      source_type: "manual",
    },
  })
  await expectApiOk(taskResponse, "create linked task")
  const taskPayload = (await taskResponse.json()) as { data?: { id?: string } }
  const taskId = taskPayload.data?.id
  expect(taskId).toBeTruthy()
  await closeSession(admin.context)

  const employeeTask = await createLoggedInSession(browser, seed.testEmployee)
  const startTaskResponse = await employeeTask.page.request.patch(`/api/tasks/${taskId}/status`, {
    data: { status: "in_progress" },
  })
  await expectApiOk(startTaskResponse, "start linked task")
  const completeTaskResponse = await employeeTask.page.request.patch(`/api/tasks/${taskId}/status`, {
    data: { status: "completed", comment: "Completed during Playwright KPI test" },
  })
  await expectApiOk(completeTaskResponse, "complete linked task")
  await employeeTask.page.goto("/goals")
  await expect(employeeTask.page.getByText(goalTitle)).toBeVisible()
  await closeSession(employeeTask.context)

  const adminReview = await createLoggedInSession(browser, seed.testAdmin)
  await adminReview.page.goto("/admin/hr?openReview=1")
  await expect(adminReview.page.getByText("Create Performance Review")).toBeVisible()
  await adminReview.page.getByRole("button", { name: "Select employee" }).click()
  await adminReview.page.getByPlaceholder("Search...").fill(seed.testEmployee.fullName || seed.testEmployee.email)
  await adminReview.page
    .getByRole("button", { name: new RegExp(seed.testEmployee.fullName || seed.testEmployee.email, "i") })
    .click()
  await adminReview.page.getByRole("button", { name: "Select review cycle" }).click()
  await adminReview.page.getByPlaceholder("Search...").fill("")
  await adminReview.page
    .getByRole("button", { name: /review/i })
    .first()
    .click()
  await adminReview.page.getByRole("button", { name: "Auto-fill from ERP" }).click()
  await expect
    .poll(async () => {
      const value = await adminReview.page.locator('input[type="number"]').first().inputValue()
      return Number(value || "0")
    })
    .toBeGreaterThan(0)
  await adminReview.page.locator("textarea").nth(0).fill("Strong delivery on assigned KPI tasks.")
  await adminReview.page.locator("textarea").nth(1).fill("Keep scaling cross-team visibility.")
  await adminReview.page.locator("textarea").nth(2).fill("Auto-filled from ERP during Playwright validation.")
  await adminReview.page.getByRole("button", { name: "Create Review" }).click()
  await closeSession(adminReview.context)

  const reviewsResponse = await adminClient
    .from("performance_reviews")
    .select("id")
    .eq("user_id", seed.testEmployee.id!)
    .eq("review_cycle_id", seed.reviewCycleId)
    .order("created_at", { ascending: false })
    .limit(1)
  const reviewId = reviewsResponse.data?.[0]?.id
  expect(reviewId).toBeTruthy()
  await adminClient.from("performance_reviews").update({ status: "completed" }).eq("id", reviewId)

  const employeeReview = await createLoggedInSession(browser, seed.testEmployee)
  await employeeReview.page.goto("/reviews")
  await expect(employeeReview.page.getByRole("button", { name: "Acknowledge Review" })).toBeVisible()
  await employeeReview.page.getByRole("button", { name: "Acknowledge Review" }).click()
  await employeeReview.page.locator("textarea").fill("Acknowledged in Playwright KPI flow.")
  await employeeReview.page.getByRole("button", { name: "I acknowledge this review" }).click()
  await expect(employeeReview.page.getByText(/Acknowledged on/i)).toBeVisible()
  await closeSession(employeeReview.context)
})
