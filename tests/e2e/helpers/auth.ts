import type { Page } from "@playwright/test"

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/auth/login")
  await page.fill('[name="email"]', email)
  await page.fill('[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(admin|profile)/)
}
