#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"

const ROOT = process.cwd()
const APP_DIR = path.join(ROOT, "app")

function toPosix(p) {
  return p.split(path.sep).join("/")
}

function inferSkeletonType(dirPosix) {
  const lower = dirPosix.toLowerCase()

  if (
    lower.includes("/auth/") ||
    lower.endsWith("/auth") ||
    lower.includes("/new") ||
    lower.includes("/edit") ||
    lower.includes("/settings") ||
    lower.includes("/setup") ||
    lower.includes("/invite") ||
    lower.includes("/forgot-password") ||
    lower.includes("/reset-password") ||
    lower.includes("/set-password") ||
    lower.includes("/employee/new")
  ) {
    return "form"
  }

  if (
    lower.includes("[") ||
    lower.includes("/profile") ||
    lower.includes("/signature") ||
    lower.includes("/suspended")
  ) {
    return "detail"
  }

  if (
    lower === "app/(app)/dashboard" ||
    lower === "app/admin" ||
    lower.endsWith("/finance") ||
    lower.endsWith("/hr") ||
    lower.endsWith("/inventory") ||
    lower.endsWith("/purchasing") ||
    lower.endsWith("/reports") ||
    lower.endsWith("/settings") ||
    lower.endsWith("/tools")
  ) {
    return "dashboard"
  }

  return "table"
}

function templateFor(type) {
  if (type === "form") {
    return `import { FormPageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return <FormPageSkeleton sections={2} fieldsPerSection={4} showSidebar={false} />
}
`
  }

  if (type === "detail") {
    return `import { DetailPageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return <DetailPageSkeleton showSidebar={true} sections={2} />
}
`
  }

  if (type === "dashboard") {
    return `import { DashboardSkeleton } from "@/components/skeletons"

export default function Loading() {
  return <DashboardSkeleton statCards={4} showActivity={true} />
}
`
  }

  return `import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return <TablePageSkeleton filters={2} columns={6} rows={8} showStats={false} />
}
`
}

async function walk(dir, pages) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(full, pages)
      continue
    }
    if (entry.isFile() && entry.name === "page.tsx") {
      pages.push(path.dirname(full))
    }
  }
}

async function main() {
  const pageDirs = []
  await walk(APP_DIR, pageDirs)

  const created = []
  const existing = []

  for (const dir of pageDirs) {
    const loadingPath = path.join(dir, "loading.tsx")
    try {
      await fs.access(loadingPath)
      existing.push(toPosix(path.relative(ROOT, loadingPath)))
      continue
    } catch {
      // missing
    }

    const dirPosix = toPosix(path.relative(ROOT, dir))
    const type = inferSkeletonType(dirPosix)
    const content = templateFor(type)
    await fs.writeFile(loadingPath, content, "utf8")
    created.push({ dir: dirPosix, loading: toPosix(path.relative(ROOT, loadingPath)), type })
  }

  const report = {
    generatedAt: new Date().toISOString(),
    pages: pageDirs.length,
    createdCount: created.length,
    existingCount: existing.length,
    created,
  }

  const reportPath = path.join(ROOT, "test-results", "ui-loading-report.json")
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8")

  console.log(`Pages: ${report.pages}`)
  console.log(`Created loading.tsx: ${report.createdCount}`)
  console.log(`Existing loading.tsx: ${report.existingCount}`)
  console.log(`Report: ${toPosix(path.relative(ROOT, reportPath))}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
