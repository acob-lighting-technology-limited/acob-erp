import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

/**
 * Enforces: a link in an email or notification must land on the tab where the reader
 * acts. The leave page once kept its tab in component state, so every leave email opened
 * "My Requests" even when it asked someone to approve. Two rules keep that from coming
 * back:
 *
 *  1. A page with tabs that any email/notification links to must read `?tab=`
 *     (`useUrlTab`, or `searchParams.get("tab")`, or a server `initialTab`).
 *  2. A link to such a page must say which tab (`?tab=`), or be listed in
 *     DEFAULT_TAB_IS_RIGHT with the reason the first tab is correct. That makes
 *     "I did not think about the tab" impossible to merge.
 */

const ROOT = process.cwd()
const SCAN_DIRS = ["app", "lib", "supabase/functions"]
const SKIP_DIRS = new Set(["node_modules", ".next", "__tests__"])

/** Links to a tabbed page that deliberately open its first tab, with why. */
const DEFAULT_TAB_IS_RIGHT: Record<string, string> = {
  "/hr/leave": "Outcomes of the reader's own request (approved, rejected, evidence) belong on My Requests",
  "/hr/attendance": "Appeal outcomes show in the Log, the first tab",
  "/admin/hr/attendance": "Device-health alerts are about today, which is the Daily Roster, the first tab",
  "/hr/lunch": "A published menu is voted on in Menu & Voting, the first tab",
  "/tasks": "Assigned, due and overdue tasks are listed under My Tasks, the first tab",
  "/tasks/management": "Task assignments and updates are listed under My Tasks, the first tab",
  "/admin/tasks": "Task alerts for admins are listed under All Tasks, the first tab",
  "/admin/correspondence": "A new letter appears under All, the first tab",
  "/admin/corporate-services/risk-register": "A new or changed risk appears in the Register, the first tab",
  "/notifications": "Needs you is the first tab and the right landing for a general alert",
  "/admin/reports/general-meeting/records": "Attendance, the first tab, is the primary new artifact",
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = path.join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

const sourceFiles = SCAN_DIRS.flatMap((dir) => (existsSync(path.join(ROOT, dir)) ? walk(path.join(ROOT, dir)) : []))
const text = new Map(sourceFiles.map((file) => [file, readFileSync(file, "utf8")]))

// ── Constants such as `const ADMIN_PATH = "/admin/..."` so `ctaPath: ADMIN_PATH` resolves ──
const constants = new Map<string, string>()
for (const content of text.values()) {
  for (const m of content.matchAll(/\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*(["'`])(\/[^"'`]*)\2/g)) {
    constants.set(m[1], m[3])
  }
}

// ── Every internal link a sender passes ──
const LINK_KEY = /\b(?:linkUrl|link_url|p_link_url|ctaPath|action_url|actionUrl|actionPath)\b\s*[:=]\s*([^\n]{0,240})/g
type Link = { raw: string; file: string }
const links: Link[] = []
for (const [file, content] of text) {
  for (const m of content.matchAll(LINK_KEY)) {
    const rest = m[1]
    for (const lit of rest.matchAll(/(["'`])(\/[^"'`\s]*)\1/g)) links.push({ raw: lit[2], file })
    const ident = rest.match(/^\s*([A-Z][A-Z0-9_]*)\b/)
    if (ident && constants.has(ident[1])) links.push({ raw: constants.get(ident[1]) as string, file })
  }
}

function normalise(raw: string) {
  const [pathPart] = raw.split("?")
  return {
    pathname: pathPart.replace(/\$\{[^}]*\}/g, "_dyn_").replace(/\/+$/, "") || "/",
    hasTab: /[?&]tab=/.test(raw),
  }
}

// ── Route table: app/**/page.tsx → URL pattern ──
const appDir = path.join(ROOT, "app")
const routes: Array<{ segments: string[]; page: string }> = []
for (const file of sourceFiles) {
  if (!file.startsWith(appDir) || !/[\\/]page\.tsx?$/.test(file)) continue
  const rel = path.relative(appDir, path.dirname(file)).split(path.sep)
  const segments = rel.filter((s) => s && !s.startsWith("(") && !s.startsWith("@"))
  routes.push({ segments, page: file })
}

function resolveRoute(pathname: string) {
  const parts = pathname.split("/").filter(Boolean)
  let best: { page: string; score: number } | null = null
  for (const route of routes) {
    if (route.segments.length !== parts.length) continue
    let score = 0
    const ok = route.segments.every((seg, i) => {
      if (seg === parts[i]) {
        score += 2
        return true
      }
      if (seg.startsWith("[")) {
        score += 1
        return true
      }
      return false
    })
    if (ok && (!best || score > best.score)) best = { page: route.page, score }
  }
  return best?.page ?? null
}

// ── The code a page is made of: the page plus everything it imports under app/ ──
function resolveImport(from: string, spec: string): string | null {
  let base: string
  if (spec.startsWith("@/app/")) base = path.join(ROOT, spec.slice(2))
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec)
  else return null
  for (const candidate of [`${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx"), path.join(base, "index.ts")]) {
    if (text.has(candidate)) return candidate
  }
  return null
}

function pageCode(page: string, seen = new Set<string>()): Set<string> {
  if (seen.has(page)) return seen
  seen.add(page)
  const content = text.get(page) ?? ""
  for (const m of content.matchAll(/from\s+["']([^"']+)["']/g)) {
    const dep = resolveImport(page, m[1])
    if (dep) pageCode(dep, seen)
  }
  return seen
}

function describe(page: string) {
  const files = [...pageCode(page)]
  const contents = files.map((f) => text.get(f) ?? "")
  const hasTabs = contents.some((c) => /\bonTabChange\s*=/.test(c))
  const readsTab = contents.some((c) => /get\(\s*["']tab["']\s*\)|\binitialTab\b|\buseUrlTab\b/.test(c))
  return { hasTabs, readsTab }
}

const linked = new Map<string, { page: string; withoutTab: Set<string>; files: Set<string> }>()
for (const link of links) {
  const { pathname, hasTab } = normalise(link.raw)
  if (pathname.startsWith("/api/") || pathname.startsWith("/images")) continue
  const page = resolveRoute(pathname)
  if (!page) continue
  const entry = linked.get(pathname) ?? { page, withoutTab: new Set<string>(), files: new Set<string>() }
  if (!hasTab) entry.withoutTab.add(link.raw)
  entry.files.add(path.relative(ROOT, link.file))
  linked.set(pathname, entry)
}

test("the scan finds the links it is meant to police", () => {
  assert.ok(links.length > 20, `expected many notification links, found ${links.length}`)
  assert.ok(linked.has("/hr/leave"), "the leave page should be among the linked pages")
})

test("every tabbed page that an email or notification links to reads ?tab=", () => {
  const offenders = [...linked.entries()]
    .filter(([, { page }]) => {
      const d = describe(page)
      return d.hasTabs && !d.readsTab
    })
    .map(([pathname, { files }]) => `${pathname}  (linked from ${[...files].join(", ")})`)
  assert.deepEqual(
    offenders,
    [],
    "These pages have tabs held only in component state, so a link cannot open the right one. " +
      "Use useUrlTab from @/hooks/use-url-tab (or read searchParams.get('tab')):\n" +
      offenders.join("\n")
  )
})

test("a link to a tabbed page names its tab, or the page is listed as default-tab-is-right", () => {
  const offenders: string[] = []
  for (const [pathname, { page, withoutTab, files }] of linked) {
    if (!describe(page).hasTabs || withoutTab.size === 0) continue
    if (DEFAULT_TAB_IS_RIGHT[pathname]) continue
    offenders.push(`${pathname}  (${[...files].join(", ")})`)
  }
  assert.deepEqual(
    offenders,
    [],
    "These links open a page with tabs but do not say which. Add ?tab=<key> to the link, or add the " +
      "path to DEFAULT_TAB_IS_RIGHT in this test with the reason the first tab is correct:\n" +
      offenders.join("\n")
  )
})

test("DEFAULT_TAB_IS_RIGHT has no stale entries", () => {
  const stale = Object.keys(DEFAULT_TAB_IS_RIGHT).filter((pathname) => {
    const entry = linked.get(pathname)
    return !entry || entry.withoutTab.size === 0 || !describe(entry.page).hasTabs
  })
  assert.deepEqual(stale, [], `Remove entries that no longer apply: ${stale.join(", ")}`)
})
