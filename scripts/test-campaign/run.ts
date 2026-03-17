import fs from "node:fs/promises"
import path from "node:path"
import { existsSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"
import { createBrowserClient } from "@supabase/ssr"

type Severity = "P0" | "P1" | "P2" | "P3"
type Category = "RBAC" | "RLS" | "CRUD" | "Workflow" | "UI" | "Responsive" | "Skeleton" | "Legacy"
type ResultStatus = "pass" | "fail" | "skip" | "blocker"

type Finding = {
  module: string
  route_or_api: string
  role: string
  severity: Severity
  category: Category
  repro_steps: string[]
  expected: string
  actual: string
  evidence: string
  status: ResultStatus
}

type CoverageRow = {
  target: string
  type: "page" | "api" | "workflow" | "diagnostic" | "static"
  role: string
  status: ResultStatus
  reason?: string
}

type PersonaKey = "developer" | "super_admin" | "admin" | "employee" | "department_lead"

type Persona = {
  key: PersonaKey
  email: string
  password: string
  id?: string
  profile?: any
  cookieHeader?: string
  accessToken?: string
}

type RouteEntry = {
  file: string
  route: string
  kind: "page" | "api"
  classification: "public_auth" | "public_onboarding" | "employee_app" | "admin" | "developer_only" | "api_only"
}

type CampaignContext = {
  rootDir: string
  outputDir: string
  baseUrl: string
  supabaseUrl: string
  supabaseAnonKey: string
  serviceRoleKey: string
  service: any
  findings: Finding[]
  coverage: CoverageRow[]
  startTime: number
  inventory: RouteEntry[]
}

const args = new Set(process.argv.slice(2))
const INVENTORY_ONLY = args.has("--inventory-only")

function envRequired(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return v
}

function envOptional(name: string): string | undefined {
  const v = process.env[name]
  return v && v.trim().length > 0 ? v : undefined
}

function nowStamp() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

async function listFiles(root: string): Promise<string[]> {
  const out: string[] = []

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else {
        out.push(full)
      }
    }
  }

  await walk(root)
  return out
}

function normalizeRouteFromAppFile(rootDir: string, fileAbs: string): { route: string; kind: "page" | "api" } | null {
  const rel = path.relative(path.join(rootDir, "app"), fileAbs).replace(/\\/g, "/")
  if (rel.endsWith("/page.tsx")) {
    const dir = rel.slice(0, -"/page.tsx".length)
    const route = "/" + stripRouteGroups(dir)
    return { route: route === "/" ? "/" : route.replace(/\/+/g, "/"), kind: "page" }
  }
  if (rel.endsWith("/route.ts")) {
    const dir = rel.slice(0, -"/route.ts".length)
    const route = "/" + stripRouteGroups(dir)
    return { route: route === "/" ? "/" : route.replace(/\/+/g, "/"), kind: "api" }
  }
  return null
}

function stripRouteGroups(routePath: string): string {
  if (!routePath) return ""
  return routePath
    .split("/")
    .filter((seg) => seg && !(seg.startsWith("(") && seg.endsWith(")")))
    .join("/")
}

function classifyRoute(route: string, kind: "page" | "api"): RouteEntry["classification"] {
  if (kind === "page") {
    if (route.startsWith("/auth")) return "public_auth"
    if (route.startsWith("/employee/new") || route === "/maintenance") return "public_onboarding"
    if (route.startsWith("/admin/dev")) return "developer_only"
    if (route.startsWith("/admin")) return "admin"
    return "employee_app"
  }

  if (route.startsWith("/api/dev")) return "developer_only"
  return "api_only"
}

async function buildInventory(rootDir: string): Promise<RouteEntry[]> {
  const appRoot = path.join(rootDir, "app")
  const files = await listFiles(appRoot)
  const entries: RouteEntry[] = []

  for (const f of files) {
    if (!f.endsWith("/page.tsx") && !f.endsWith("/route.ts")) continue
    const normalized = normalizeRouteFromAppFile(rootDir, f)
    if (!normalized) continue
    entries.push({
      file: path.relative(rootDir, f).replace(/\\/g, "/"),
      route: normalized.route,
      kind: normalized.kind,
      classification: classifyRoute(normalized.route, normalized.kind),
    })
  }

  return entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1
    return a.route.localeCompare(b.route)
  })
}

function addFinding(ctx: CampaignContext, finding: Finding) {
  ctx.findings.push(finding)
}

function addCoverage(ctx: CampaignContext, row: CoverageRow) {
  ctx.coverage.push(row)
}

function asCookieHeader(cookies: Map<string, string>): string {
  return Array.from(cookies.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ")
}

function getProjectRef(supabaseUrl: string): string {
  return new URL(supabaseUrl).hostname.split(".")[0]
}

async function authenticatePersona(
  ctx: CampaignContext,
  key: PersonaKey,
  email: string,
  password: string
): Promise<Persona | null> {
  const cookieJar = new Map<string, string>()

  const browserClient = createBrowserClient(ctx.supabaseUrl, ctx.supabaseAnonKey, {
    cookies: {
      getAll() {
        return Array.from(cookieJar.entries()).map(([name, value]) => ({ name, value }))
      },
      setAll(cookies) {
        for (const cookie of cookies) {
          cookieJar.set(cookie.name, cookie.value)
        }
      },
    },
  })

  const { data, error } = await browserClient.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    addFinding(ctx, {
      module: "auth",
      route_or_api: "supabase.auth.signInWithPassword",
      role: key,
      severity: "P1",
      category: "RBAC",
      repro_steps: [`Sign in with seeded ${key} credentials.`],
      expected: "Persona should authenticate successfully.",
      actual: error?.message || "No session returned",
      evidence: JSON.stringify({ email, error: error?.message ?? null }),
      status: "blocker",
    })
    return null
  }

  const { data: profile } = await ctx.service
    .from("profiles")
    .select("id, role, department, is_department_lead, lead_departments, employment_status")
    .eq("id", data.user.id)
    .single()

  const cookieHeader = asCookieHeader(cookieJar)
  return {
    key,
    email,
    password,
    id: data.user.id,
    profile,
    cookieHeader,
    accessToken: data.session.access_token,
  }
}

async function loadPersonas(ctx: CampaignContext): Promise<Record<PersonaKey, Persona | null>> {
  const defs: Record<PersonaKey, { email?: string; password?: string }> = {
    developer: {
      email: envOptional("TEST_USER_DEVELOPER_EMAIL"),
      password: envOptional("TEST_USER_DEVELOPER_PASSWORD"),
    },
    super_admin: {
      email: envOptional("TEST_USER_SUPER_ADMIN_EMAIL"),
      password: envOptional("TEST_USER_SUPER_ADMIN_PASSWORD"),
    },
    admin: {
      email: envOptional("TEST_USER_ADMIN_EMAIL"),
      password: envOptional("TEST_USER_ADMIN_PASSWORD"),
    },
    employee: {
      email: envOptional("TEST_USER_EMPLOYEE_EMAIL"),
      password: envOptional("TEST_USER_EMPLOYEE_PASSWORD"),
    },
    department_lead: {
      email: envOptional("TEST_USER_DEPARTMENT_LEAD_EMAIL"),
      password: envOptional("TEST_USER_DEPARTMENT_LEAD_PASSWORD"),
    },
  }

  const personas: Record<PersonaKey, Persona | null> = {
    developer: null,
    super_admin: null,
    admin: null,
    employee: null,
    department_lead: null,
  }

  for (const key of Object.keys(defs) as PersonaKey[]) {
    const d = defs[key]
    if (!d.email || !d.password) {
      addFinding(ctx, {
        module: "config",
        route_or_api: "persona_credentials",
        role: key,
        severity: "P1",
        category: "Legacy",
        repro_steps: [
          `Set TEST_USER_${key.toUpperCase()}_EMAIL and TEST_USER_${key.toUpperCase()}_PASSWORD in environment.`,
        ],
        expected: "All seeded personas must be available for full RBAC campaign coverage.",
        actual: "Credentials missing for this persona.",
        evidence: JSON.stringify({ persona: key }),
        status: "blocker",
      })
      continue
    }

    const p = await authenticatePersona(ctx, key, d.email, d.password)
    personas[key] = p
    addCoverage(ctx, {
      target: `persona:${key}`,
      type: "diagnostic",
      role: key,
      status: p ? "pass" : "blocker",
      reason: p ? "Authenticated and loaded profile." : "Authentication failed.",
    })
  }

  return personas
}

async function runRbacDeepAudit(ctx: CampaignContext) {
  const script = path.join(ctx.rootDir, "scripts", "rbac-deep-audit.cjs")
  if (!existsSync(script)) {
    addCoverage(ctx, {
      target: "scripts/rbac-deep-audit.cjs",
      type: "diagnostic",
      role: "system",
      status: "skip",
      reason: "Script not found.",
    })
    return
  }

  let stdout = ""
  let executionError: any = null
  try {
    stdout = execFileSync("node", [script], {
      cwd: ctx.rootDir,
      env: {
        ...process.env,
        SKIP_DB: "0",
        NEXT_PUBLIC_SUPABASE_URL: ctx.supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: ctx.serviceRoleKey,
      },
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    })
  } catch (error: any) {
    executionError = error
    stdout = String(error?.stdout || "")
  }

  if (stdout.trim().length > 0) {
    await fs.writeFile(path.join(ctx.outputDir, "rbac-deep-audit.stdout.log"), stdout, "utf8")
  }

  const reportPath = path.join(ctx.rootDir, "RBAC_DEEP_TEST_REPORT.md")
  if (existsSync(reportPath)) {
    const report = await fs.readFile(reportPath, "utf8")
    const failedMatch = report.match(/Failed checks:\s*(\d+)/i)
    const failed = failedMatch ? Number(failedMatch[1]) : 0

    addCoverage(ctx, {
      target: "scripts/rbac-deep-audit.cjs",
      type: "diagnostic",
      role: "system",
      status: failed > 0 ? "fail" : "pass",
      reason: failed > 0 ? `${failed} check(s) failed in RBAC deep audit.` : "RBAC deep audit passed.",
    })

    if (failed > 0) {
      addFinding(ctx, {
        module: "rbac",
        route_or_api: "scripts/rbac-deep-audit.cjs",
        role: "system",
        severity: "P1",
        category: "RBAC",
        repro_steps: ["Run `node scripts/rbac-deep-audit.cjs` with DB checks enabled."],
        expected: "No failed checks.",
        actual: `${failed} checks failed in RBAC deep audit report.`,
        evidence: reportPath,
        status: "fail",
      })
    }
    return
  }

  addCoverage(ctx, {
    target: "scripts/rbac-deep-audit.cjs",
    type: "diagnostic",
    role: "system",
    status: "blocker",
    reason: executionError?.message || "Execution failed before report generation",
  })
  addFinding(ctx, {
    module: "rbac",
    route_or_api: "scripts/rbac-deep-audit.cjs",
    role: "system",
    severity: "P1",
    category: "RBAC",
    repro_steps: ["Run `node scripts/rbac-deep-audit.cjs` with valid env vars."],
    expected: "Script should generate RBAC_DEEP_TEST_REPORT.md.",
    actual: executionError?.message || "Execution failed.",
    evidence: String(executionError?.stderr || executionError),
    status: "blocker",
  })
}

async function runDiagnosticsWithServiceRole(ctx: CampaignContext) {
  // Leave route diagnostics
  const { data: leaveRoutes, error: leaveErr } = await ctx.service
    .from("leave_approval_role_routes")
    .select("requester_kind, stage_order, approver_role_code, is_active")
    .order("requester_kind")
    .order("stage_order")

  if (leaveErr) {
    addCoverage(ctx, {
      target: "/api/dev/leave-route-diagnostics",
      type: "diagnostic",
      role: "developer",
      status: "blocker",
      reason: leaveErr.message,
    })
  } else {
    let broken = 0
    for (const row of (leaveRoutes || []) as any[]) {
      if (!row.is_active) {
        broken += 1
        continue
      }

      const roleCode = String(row.approver_role_code)
      if (roleCode === "reliever" || roleCode === "department_lead") continue

      if (["admin_hr_lead", "hcs", "md"].includes(roleCode)) {
        const departmentName =
          roleCode === "admin_hr_lead"
            ? "Admin & HR"
            : roleCode === "hcs"
              ? "Corporate Services"
              : "Executive Management"
        const { data: profiles } = await ctx.service
          .from("profiles")
          .select("id, department, lead_departments, is_department_lead, employment_status")
          .eq("is_department_lead", true)
          .eq("employment_status", "active")

        const matches = (profiles || []).filter((p: any) => {
          const managed = Array.isArray(p.lead_departments) ? p.lead_departments : []
          return p.department === departmentName || managed.includes(departmentName)
        })

        if (matches.length !== 1) broken += 1
      } else {
        const now = new Date().toISOString()
        const { data } = await ctx.service
          .from("leave_approver_assignments")
          .select("user_id, effective_from, effective_to, is_primary")
          .eq("approver_role_code", roleCode)
          .eq("is_active", true)
          .eq("scope_type", "global")

        const valid = (data || []).filter((x: any) => {
          const startsOk = !x.effective_from || x.effective_from <= now
          const endsOk = !x.effective_to || x.effective_to >= now
          return startsOk && endsOk
        })

        if (valid.length < 1) broken += 1
      }
    }

    addCoverage(ctx, {
      target: "/api/dev/leave-route-diagnostics",
      type: "diagnostic",
      role: "developer",
      status: broken === 0 ? "pass" : "fail",
      reason: broken === 0 ? "All route stages resolvable." : `${broken} leave route stage(s) unresolved/conflicted.`,
    })

    if (broken > 0) {
      addFinding(ctx, {
        module: "leave",
        route_or_api: "/api/dev/leave-route-diagnostics",
        role: "developer",
        severity: "P1",
        category: "Workflow",
        repro_steps: ["Run leave route diagnostics and inspect unresolved stages."],
        expected: "Every active route stage resolves to exactly one valid approver.",
        actual: `${broken} route stage(s) unresolved/conflicted.`,
        evidence: JSON.stringify({ broken }),
        status: "fail",
      })
    }
  }

  // Help desk diagnostics
  const [deptRes, profRes] = await Promise.all([
    ctx.service.from("departments").select("name"),
    ctx.service
      .from("profiles")
      .select("id, full_name, role, department, is_department_lead, lead_departments, employment_status")
      .eq("employment_status", "active"),
  ])

  if (deptRes.error || profRes.error) {
    addCoverage(ctx, {
      target: "/api/dev/help-desk-route-diagnostics",
      type: "diagnostic",
      role: "developer",
      status: "blocker",
      reason: deptRes.error?.message || profRes.error?.message || "failed",
    })
  } else {
    const departments = (deptRes.data || []).map((d: any) => d.name).filter(Boolean)
    const profiles = profRes.data || []
    const multiLead = new Set(
      (profiles || [])
        .filter((p: any) => p.is_department_lead)
        .filter((p: any) => {
          const managed = new Set([p.department, ...(Array.isArray(p.lead_departments) ? p.lead_departments : [])])
          managed.delete(null as any)
          managed.delete(undefined as any)
          return managed.size > 1
        })
        .map((p: any) => p.id)
    )

    let broken = 0
    for (const d of (departments || []) as any[]) {
      const lead = ((profiles || []) as any[]).find((p: any) => {
        const managed = new Set([p.department, ...(Array.isArray(p.lead_departments) ? p.lead_departments : [])])
        return p.is_department_lead && managed.has(d)
      })
      if (!lead || multiLead.has(lead.id)) broken += 1
    }

    const hcs = ((profiles || []) as any[]).find((p: any) => {
      const managed = Array.isArray(p.lead_departments) ? p.lead_departments : []
      return (
        (["developer", "super_admin", "admin"].includes(p.role) || p.is_department_lead) &&
        (p.department === "Corporate Services" || managed.includes("Corporate Services"))
      )
    })
    const md = ((profiles || []) as any[]).find((p: any) => {
      return (
        (["developer", "super_admin", "admin"].includes(p.role) && p.department === "Executive Management") ||
        p.role === "developer" ||
        p.role === "super_admin"
      )
    })
    if (!hcs) broken += 1
    if (!md) broken += 1

    addCoverage(ctx, {
      target: "/api/dev/help-desk-route-diagnostics",
      type: "diagnostic",
      role: "developer",
      status: broken === 0 ? "pass" : "fail",
      reason: broken === 0 ? "Help desk routing prerequisites healthy." : `${broken} help-desk prerequisite issue(s).`,
    })

    if (broken > 0) {
      addFinding(ctx, {
        module: "help-desk",
        route_or_api: "/api/dev/help-desk-route-diagnostics",
        role: "developer",
        severity: "P1",
        category: "Workflow",
        repro_steps: ["Run help desk route diagnostics and review missing lead/approver prerequisites."],
        expected: "Department lead coverage + HCS + MD approvers resolved.",
        actual: `${broken} prerequisite issue(s) found.`,
        evidence: JSON.stringify({ broken }),
        status: "fail",
      })
    }
  }

  // Task diagnostics
  if (deptRes.error || profRes.error) {
    addCoverage(ctx, {
      target: "/api/dev/task-route-diagnostics",
      type: "diagnostic",
      role: "developer",
      status: "blocker",
      reason: deptRes.error?.message || profRes.error?.message || "failed",
    })
  } else {
    const departments = (deptRes.data || []).map((d: any) => d.name).filter(Boolean)
    const profiles = profRes.data || []

    let broken = 0
    for (const d of departments) {
      const lead = profiles.find((p: any) => {
        const managed = new Set([p.department, ...(Array.isArray(p.lead_departments) ? p.lead_departments : [])])
        return p.is_department_lead && managed.has(d)
      })
      if (!lead) broken += 1

      const members = profiles.filter((p: any) => p.department === d)
      if (members.length === 0) broken += 1
    }

    addCoverage(ctx, {
      target: "/api/dev/task-route-diagnostics",
      type: "diagnostic",
      role: "developer",
      status: broken === 0 ? "pass" : "fail",
      reason: broken === 0 ? "Task routing prerequisites healthy." : `${broken} task prerequisite issue(s).`,
    })

    if (broken > 0) {
      addFinding(ctx, {
        module: "tasks",
        route_or_api: "/api/dev/task-route-diagnostics",
        role: "developer",
        severity: "P1",
        category: "Workflow",
        repro_steps: ["Run task route diagnostics and inspect uncovered departments."],
        expected: "Each department has lead coverage and active assignment targets.",
        actual: `${broken} prerequisite issue(s) found.`,
        evidence: JSON.stringify({ broken }),
        status: "fail",
      })
    }
  }
}

async function fetchWithCookie(url: string, cookieHeader?: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {})
  if (cookieHeader) headers.set("cookie", cookieHeader)
  return fetch(url, { ...init, headers, redirect: "manual" })
}

function shouldSkipDynamic(route: string): boolean {
  return route.includes("[")
}

async function runRouteAccessChecks(ctx: CampaignContext, personas: Record<PersonaKey, Persona | null>) {
  const pages = ctx.inventory.filter((x) => x.kind === "page")
  const apis = ctx.inventory.filter((x) => x.kind === "api")

  // Unauthenticated checks for all non-dynamic pages
  for (const page of pages) {
    if (shouldSkipDynamic(page.route)) {
      addCoverage(ctx, {
        target: page.route,
        type: "page",
        role: "unauthenticated",
        status: "skip",
        reason: "Dynamic route skipped in anonymous crawl.",
      })
      continue
    }

    const res = await fetchWithCookie(`${ctx.baseUrl}${page.route}`)
    const location = res.headers.get("location") || ""

    const expectPublic = page.classification === "public_auth" || page.classification === "public_onboarding"
    const redirectedToLogin = location.includes("/auth/login")

    if (expectPublic) {
      const ok = res.status < 400 || redirectedToLogin || location.includes("/maintenance")
      addCoverage(ctx, {
        target: page.route,
        type: "page",
        role: "unauthenticated",
        status: ok ? "pass" : "fail",
        reason: `HTTP ${res.status}${location ? ` -> ${location}` : ""}`,
      })
      if (!ok) {
        addFinding(ctx, {
          module: "routing",
          route_or_api: page.route,
          role: "unauthenticated",
          severity: "P2",
          category: "RBAC",
          repro_steps: [`Open ${page.route} without login.`],
          expected: "Public/auth route should be reachable or intentionally redirected.",
          actual: `HTTP ${res.status}${location ? ` -> ${location}` : ""}`,
          evidence: JSON.stringify({ status: res.status, location }),
          status: "fail",
        })
      }
    } else {
      const ok =
        redirectedToLogin ||
        location.includes("/maintenance") ||
        res.status === 401 ||
        (res.status >= 300 && res.status < 400)
      addCoverage(ctx, {
        target: page.route,
        type: "page",
        role: "unauthenticated",
        status: ok ? "pass" : "fail",
        reason: `HTTP ${res.status}${location ? ` -> ${location}` : ""}`,
      })
      if (!ok) {
        addFinding(ctx, {
          module: "routing",
          route_or_api: page.route,
          role: "unauthenticated",
          severity: "P1",
          category: "RBAC",
          repro_steps: [`Open ${page.route} without login.`],
          expected: "Protected route should redirect to login or maintenance.",
          actual: `Route did not enforce auth boundary (HTTP ${res.status}, location=${location || "none"}).`,
          evidence: JSON.stringify({ status: res.status, location }),
          status: "fail",
        })
      }
    }
  }

  // Role-aware checks for admin/dev pages using cookie sessions
  const roleChecks: Array<{ key: PersonaKey; routes: string[]; expected: "allow" | "deny" }> = [
    { key: "developer", routes: ["/admin/dev", "/admin/dev/tests", "/admin"], expected: "allow" },
    { key: "super_admin", routes: ["/admin", "/admin/dev/tests"], expected: "deny" },
    { key: "admin", routes: ["/admin", "/admin/dev/tests"], expected: "deny" },
    { key: "department_lead", routes: ["/admin", "/admin/dev/tests"], expected: "deny" },
    { key: "employee", routes: ["/admin", "/admin/dev/tests"], expected: "deny" },
  ]

  for (const check of roleChecks) {
    const persona = personas[check.key]
    if (!persona?.cookieHeader) {
      for (const route of check.routes) {
        addCoverage(ctx, {
          target: route,
          type: "page",
          role: check.key,
          status: "skip",
          reason: "Persona unavailable.",
        })
      }
      continue
    }

    for (const route of check.routes) {
      const res = await fetchWithCookie(`${ctx.baseUrl}${route}`, persona.cookieHeader)
      const location = res.headers.get("location") || ""
      const denied = location.includes("/admin") || location.includes("/dashboard") || location.includes("/auth/login")
      const allowed =
        res.status < 400 &&
        !location.includes("/auth/login") &&
        !(route.includes("/admin/dev") && location.includes("/admin"))

      const ok = check.expected === "allow" ? allowed : denied
      addCoverage(ctx, {
        target: route,
        type: "page",
        role: check.key,
        status: ok ? "pass" : "fail",
        reason: `HTTP ${res.status}${location ? ` -> ${location}` : ""}`,
      })

      if (!ok) {
        addFinding(ctx, {
          module: "routing",
          route_or_api: route,
          role: check.key,
          severity: "P1",
          category: "RBAC",
          repro_steps: [`Sign in as ${check.key}`, `Open ${route}`],
          expected: check.expected === "allow" ? "Access should be granted." : "Access should be denied/redirected.",
          actual: `HTTP ${res.status}${location ? ` -> ${location}` : ""}`,
          evidence: JSON.stringify({ role: check.key, status: res.status, location }),
          status: "fail",
        })
      }
    }
  }

  // API auth boundary checks for unauthenticated access (GET-only)
  for (const api of apis) {
    if (api.route.includes("[") || api.route.includes("/api/dev/")) {
      addCoverage(ctx, {
        target: api.route,
        type: "api",
        role: "unauthenticated",
        status: "skip",
        reason: "Dynamic/dev route skipped in generic unauthenticated API crawl.",
      })
      continue
    }

    const res = await fetchWithCookie(`${ctx.baseUrl}${api.route}`, undefined, { method: "GET" })
    const location = res.headers.get("location") || ""
    const isSecure =
      [401, 403, 405].includes(res.status) ||
      (res.status >= 300 && res.status < 400) ||
      location.includes("/auth/login") ||
      location.includes("/maintenance")
    addCoverage(ctx, {
      target: api.route,
      type: "api",
      role: "unauthenticated",
      status: isSecure ? "pass" : "fail",
      reason: `HTTP ${res.status}`,
    })

    if (!isSecure) {
      addFinding(ctx, {
        module: "api",
        route_or_api: api.route,
        role: "unauthenticated",
        severity: "P1",
        category: "RBAC",
        repro_steps: [`GET ${api.route} without authentication.`],
        expected: "Endpoint should reject unauthorized access.",
        actual: `HTTP ${res.status}`,
        evidence: JSON.stringify({ status: res.status }),
        status: "fail",
      })
    }
  }
}

async function runWorkflowTests(ctx: CampaignContext, personas: Record<PersonaKey, Persona | null>) {
  const developer = personas.developer
  const employee = personas.employee
  const lead = personas.department_lead

  if (!developer?.cookieHeader || !employee?.id || !lead?.id) {
    addCoverage(ctx, {
      target: "workflow:leave/helpdesk/task",
      type: "workflow",
      role: "developer",
      status: "skip",
      reason: "Developer cookie or seed IDs unavailable.",
    })
    return
  }

  const { data: leaveType } = await ctx.service
    .from("leave_types")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (!leaveType?.id) {
    addCoverage(ctx, {
      target: "/api/dev/leave-flow-test",
      type: "workflow",
      role: "developer",
      status: "blocker",
      reason: "No active leave type available.",
    })
    addFinding(ctx, {
      module: "leave",
      route_or_api: "/api/dev/leave-flow-test",
      role: "developer",
      severity: "P1",
      category: "Workflow",
      repro_steps: ["Ensure at least one active leave type exists in staging."],
      expected: "Leave flow test prerequisites are available.",
      actual: "No active leave type found.",
      evidence: "leave_types query returned empty",
      status: "blocker",
    })
  } else {
    const leaveRes = await fetchWithCookie(`${ctx.baseUrl}/api/dev/leave-flow-test`, developer.cookieHeader, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requester_id: employee.id,
        reliever_id: lead.id,
        leave_type_id: leaveType.id,
        cleanup: true,
      }),
    })
    const leaveJson = await leaveRes.json().catch(() => ({}) as any)
    const leaveOk = leaveRes.ok && leaveJson.ok === true
    addCoverage(ctx, {
      target: "/api/dev/leave-flow-test",
      type: "workflow",
      role: "developer",
      status: leaveOk ? "pass" : "fail",
      reason: leaveOk ? "Workflow passed." : `HTTP ${leaveRes.status}`,
    })
    if (!leaveOk) {
      addFinding(ctx, {
        module: "leave",
        route_or_api: "/api/dev/leave-flow-test",
        role: "developer",
        severity: "P1",
        category: "Workflow",
        repro_steps: ["Run leave flow test endpoint with seeded requester/reliever IDs."],
        expected: "Flow should complete all stages and cleanup.",
        actual: JSON.stringify(leaveJson),
        evidence: JSON.stringify({ status: leaveRes.status, body: leaveJson }),
        status: "fail",
      })
    }
  }

  const employeeProfile = employee.profile
  const serviceDepartment = employeeProfile?.department || "Operations"

  const helpRes = await fetchWithCookie(`${ctx.baseUrl}/api/dev/flow-tests`, developer.cookieHeader, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "help_desk",
      requester_id: employee.id,
      service_department: serviceDepartment,
      request_type: "support",
      support_mode: "open_queue",
      cleanup: true,
    }),
  })
  const helpJson = await helpRes.json().catch(() => ({}) as any)
  const helpOk = helpRes.ok && helpJson.ok === true
  addCoverage(ctx, {
    target: "/api/dev/flow-tests(kind=help_desk)",
    type: "workflow",
    role: "developer",
    status: helpOk ? "pass" : "fail",
    reason: helpOk ? "Workflow passed." : `HTTP ${helpRes.status}`,
  })
  if (!helpOk) {
    addFinding(ctx, {
      module: "help-desk",
      route_or_api: "/api/dev/flow-tests",
      role: "developer",
      severity: "P1",
      category: "Workflow",
      repro_steps: ["POST /api/dev/flow-tests with kind=help_desk and cleanup=true."],
      expected: "Support flow should complete and resolve ticket.",
      actual: JSON.stringify(helpJson),
      evidence: JSON.stringify({ status: helpRes.status, body: helpJson }),
      status: "fail",
    })
  }

  const taskRes = await fetchWithCookie(`${ctx.baseUrl}/api/dev/flow-tests`, developer.cookieHeader, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "task",
      creator_id: developer.id,
      assignee_id: employee.id,
      cleanup: true,
    }),
  })
  const taskJson = await taskRes.json().catch(() => ({}) as any)
  const taskOk = taskRes.ok && taskJson.ok === true
  addCoverage(ctx, {
    target: "/api/dev/flow-tests(kind=task)",
    type: "workflow",
    role: "developer",
    status: taskOk ? "pass" : "fail",
    reason: taskOk ? "Workflow passed." : `HTTP ${taskRes.status}`,
  })
  if (!taskOk) {
    addFinding(ctx, {
      module: "tasks",
      route_or_api: "/api/dev/flow-tests",
      role: "developer",
      severity: "P1",
      category: "Workflow",
      repro_steps: ["POST /api/dev/flow-tests with kind=task and cleanup=true."],
      expected: "Task flow should create/start/complete and cleanup.",
      actual: JSON.stringify(taskJson),
      evidence: JSON.stringify({ status: taskRes.status, body: taskJson }),
      status: "fail",
    })
  }
}

async function runRlsNegativeTests(ctx: CampaignContext, personas: Record<PersonaKey, Persona | null>) {
  const employee = personas.employee
  const lead = personas.department_lead
  const developer = personas.developer

  const targetOther = lead?.id || developer?.id
  if (!employee?.id || !targetOther) {
    addCoverage(ctx, {
      target: "rls-negative-tests",
      type: "diagnostic",
      role: "employee",
      status: "skip",
      reason: "Required persona IDs unavailable.",
    })
    return
  }

  const employeeClient = createClient(ctx.supabaseUrl, ctx.supabaseAnonKey)
  const signInRes = await employeeClient.auth.signInWithPassword({ email: employee.email, password: employee.password })
  if (signInRes.error) {
    addCoverage(ctx, {
      target: "rls-negative-tests",
      type: "diagnostic",
      role: "employee",
      status: "blocker",
      reason: signInRes.error.message,
    })
    return
  }

  const random = Buffer.from(crypto.getRandomValues(new Uint8Array(6))).toString("hex")

  const deptInsert = await employeeClient
    .from("departments")
    .insert({ name: `[TEST-RLS-${random}]`, description: "RLS probe", is_active: true })
    .select("id")
    .maybeSingle()

  const deptWriteDenied = Boolean(deptInsert.error)
  addCoverage(ctx, {
    target: "table:departments insert",
    type: "diagnostic",
    role: "employee",
    status: deptWriteDenied ? "pass" : "fail",
    reason: deptWriteDenied ? deptInsert.error!.message : "Insert succeeded",
  })
  if (!deptWriteDenied) {
    const insertedId = deptInsert.data?.id
    if (insertedId) {
      await ctx.service.from("departments").delete().eq("id", insertedId)
    }
    addFinding(ctx, {
      module: "departments",
      route_or_api: "supabase:departments.insert",
      role: "employee",
      severity: "P0",
      category: "RLS",
      repro_steps: ["Sign in as employee via anon client.", "Insert a department row."],
      expected: "Employee write should be denied by RLS/RBAC.",
      actual: "Insert succeeded.",
      evidence: JSON.stringify(deptInsert.data),
      status: "fail",
    })
  }

  const profileUpdate = await employeeClient
    .from("profiles")
    .update({ first_name: "RLSProbe" })
    .eq("id", targetOther)
    .select("id")

  const profileWriteDenied = Boolean(profileUpdate.error)
  addCoverage(ctx, {
    target: "table:profiles update(other user)",
    type: "diagnostic",
    role: "employee",
    status: profileWriteDenied ? "pass" : "fail",
    reason: profileWriteDenied ? profileUpdate.error!.message : "Update succeeded",
  })
  if (!profileWriteDenied) {
    addFinding(ctx, {
      module: "profiles",
      route_or_api: "supabase:profiles.update",
      role: "employee",
      severity: "P0",
      category: "RLS",
      repro_steps: ["Sign in as employee.", "Update another user profile row."],
      expected: "Cross-user profile updates should be denied.",
      actual: "Update succeeded.",
      evidence: JSON.stringify(profileUpdate.data),
      status: "fail",
    })
  }

  await employeeClient.auth.signOut()
}

async function runUiStaticChecks(ctx: CampaignContext) {
  const auditScript = path.join(ctx.rootDir, "scripts", "ui", "audit-reusables.mjs")
  const reportPath = path.join(ctx.rootDir, "test-results", "ui-audit-report.json")

  try {
    execFileSync("node", [auditScript], {
      cwd: ctx.rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    })
  } catch {
    // audit exits non-zero when violations exist; report is still generated.
  }

  try {
    const reportRaw = await fs.readFile(reportPath, "utf8")
    const report = JSON.parse(reportRaw) as {
      summary: {
        missingLoading: number
        headerViolations: number
        tableViolations: number
        statsViolations: number
      }
      violations: {
        missingLoading: string[]
        header: string[]
        table: string[]
        stats: string[]
      }
    }

    addCoverage(ctx, {
      target: "ui:audit loading coverage",
      type: "static",
      role: "system",
      status: report.summary.missingLoading === 0 ? "pass" : "fail",
      reason:
        report.summary.missingLoading === 0
          ? "All page directories include loading.tsx."
          : `${report.summary.missingLoading} page directories missing loading.tsx.`,
    })
    addCoverage(ctx, {
      target: "ui:audit header standard",
      type: "static",
      role: "system",
      status: report.summary.headerViolations === 0 ? "pass" : "fail",
      reason:
        report.summary.headerViolations === 0
          ? "All non-exempt pages use custom header/wrapper."
          : `${report.summary.headerViolations} page(s) violate header standard.`,
    })
    addCoverage(ctx, {
      target: "ui:audit table wrapper standard",
      type: "static",
      role: "system",
      status: report.summary.tableViolations === 0 ? "pass" : "fail",
      reason:
        report.summary.tableViolations === 0
          ? "All table surfaces use shared wrappers/allowlist."
          : `${report.summary.tableViolations} file(s) violate table wrapper standard.`,
    })
    addCoverage(ctx, {
      target: "ui:audit stat-card standard",
      type: "static",
      role: "system",
      status: report.summary.statsViolations === 0 ? "pass" : "fail",
      reason:
        report.summary.statsViolations === 0
          ? "All page-level metric cards use StatCard/allowlist."
          : `${report.summary.statsViolations} file(s) violate stat-card standard.`,
    })

    if (report.summary.missingLoading > 0) {
      addFinding(ctx, {
        module: "ui",
        route_or_api: "loading.tsx coverage",
        role: "system",
        severity: "P3",
        category: "Skeleton",
        repro_steps: ["Run `node scripts/ui/audit-reusables.mjs` and inspect missingLoading violations."],
        expected: "Every page directory should include responsive loading.tsx.",
        actual: `${report.summary.missingLoading} missing loading.tsx directories.`,
        evidence: JSON.stringify(report.violations.missingLoading.slice(0, 20)),
        status: "fail",
      })
    }
    if (report.summary.headerViolations > 0) {
      addFinding(ctx, {
        module: "ui",
        route_or_api: "custom header standard",
        role: "system",
        severity: "P2",
        category: "UI",
        repro_steps: ["Run `node scripts/ui/audit-reusables.mjs` and inspect header violations."],
        expected: "All non-exempt pages should use PageHeader via approved wrapper.",
        actual: `${report.summary.headerViolations} page(s) violate header standard.`,
        evidence: JSON.stringify(report.violations.header.slice(0, 20)),
        status: "fail",
      })
    }
    if (report.summary.tableViolations > 0) {
      addFinding(ctx, {
        module: "ui",
        route_or_api: "table wrapper standard",
        role: "system",
        severity: "P2",
        category: "UI",
        repro_steps: ["Run `node scripts/ui/audit-reusables.mjs` and inspect table violations."],
        expected: "Table surfaces should use shared app/admin wrappers unless allowlisted.",
        actual: `${report.summary.tableViolations} file(s) violate table wrapper standard.`,
        evidence: JSON.stringify(report.violations.table.slice(0, 20)),
        status: "fail",
      })
    }
    if (report.summary.statsViolations > 0) {
      addFinding(ctx, {
        module: "ui",
        route_or_api: "stat-card standard",
        role: "system",
        severity: "P2",
        category: "UI",
        repro_steps: ["Run `node scripts/ui/audit-reusables.mjs` and inspect stats violations."],
        expected: "Page-level metric cards should use StatCard unless allowlisted.",
        actual: `${report.summary.statsViolations} file(s) violate stat-card standard.`,
        evidence: JSON.stringify(report.violations.stats.slice(0, 20)),
        status: "fail",
      })
    }
  } catch (error: any) {
    addCoverage(ctx, {
      target: "ui:audit",
      type: "static",
      role: "system",
      status: "blocker",
      reason: error?.message || "Failed to parse UI audit report.",
    })
    addFinding(ctx, {
      module: "ui",
      route_or_api: "ui:audit report",
      role: "system",
      severity: "P1",
      category: "Legacy",
      repro_steps: ["Run `node scripts/ui/audit-reusables.mjs` and verify report generation."],
      expected: "UI audit should produce a parseable JSON report.",
      actual: error?.message || "Report missing/unparseable.",
      evidence: String(error),
      status: "blocker",
    })
  }

  const componentFiles = (await listFiles(path.join(ctx.rootDir, "components"))).filter((f) => f.endsWith(".tsx"))
  let modalResponsiveWarnings = 0
  for (const file of componentFiles) {
    const content = await fs.readFile(file, "utf8")
    if (!content.includes("<DialogContent")) continue

    const hasResponsiveHints =
      /DialogContent[^>]*className=\"[^\"]*(max-w|sm:|md:|overflow-y-auto)[^\"]*\"/m.test(content) ||
      /DialogContent[^>]*className=\{[^\}]*max-w[^\}]*\}/m.test(content)

    if (!hasResponsiveHints) {
      modalResponsiveWarnings += 1
      addCoverage(ctx, {
        target: path.relative(ctx.rootDir, file).replace(/\\/g, "/"),
        type: "static",
        role: "system",
        status: "fail",
        reason: "DialogContent without obvious responsive constraints.",
      })
    }
  }

  if (modalResponsiveWarnings > 0) {
    addFinding(ctx, {
      module: "ui",
      route_or_api: "DialogContent responsive constraints",
      role: "system",
      severity: "P2",
      category: "Responsive",
      repro_steps: ["Scan components with DialogContent and verify width/overflow responsive classes."],
      expected: "Modals should include mobile-safe width/overflow constraints.",
      actual: `${modalResponsiveWarnings} modal component(s) missing clear responsive constraints.`,
      evidence: JSON.stringify({ modalResponsiveWarnings }),
      status: "fail",
    })
  }
}

function summarizeCoverage(ctx: CampaignContext) {
  const counts = { pass: 0, fail: 0, skip: 0, blocker: 0 }
  for (const c of ctx.coverage) counts[c.status] += 1
  return counts
}

function severityRank(s: Severity): number {
  if (s === "P0") return 0
  if (s === "P1") return 1
  if (s === "P2") return 2
  return 3
}

async function writeOutputs(ctx: CampaignContext) {
  const counts = summarizeCoverage(ctx)
  const elapsedSec = Math.round((Date.now() - ctx.startTime) / 1000)

  const sortedFindings = [...ctx.findings].sort((a, b) => {
    const sv = severityRank(a.severity) - severityRank(b.severity)
    if (sv !== 0) return sv
    return a.route_or_api.localeCompare(b.route_or_api)
  })

  const reportJson = {
    generated_at: new Date().toISOString(),
    duration_seconds: elapsedSec,
    summary: {
      total_findings: sortedFindings.length,
      by_severity: {
        P0: sortedFindings.filter((f) => f.severity === "P0").length,
        P1: sortedFindings.filter((f) => f.severity === "P1").length,
        P2: sortedFindings.filter((f) => f.severity === "P2").length,
        P3: sortedFindings.filter((f) => f.severity === "P3").length,
      },
      coverage: counts,
      total_targets: ctx.coverage.length,
      total_routes: ctx.inventory.length,
      pages: ctx.inventory.filter((x) => x.kind === "page").length,
      apis: ctx.inventory.filter((x) => x.kind === "api").length,
    },
    findings: sortedFindings,
    coverage_matrix: ctx.coverage,
    route_inventory: ctx.inventory,
  }

  const jsonPath = path.join(ctx.outputDir, "campaign-report.json")
  await fs.writeFile(jsonPath, JSON.stringify(reportJson, null, 2), "utf8")

  const lines: string[] = []
  lines.push("# ERP Comprehensive Test Campaign Report")
  lines.push("")
  lines.push(`Generated: ${reportJson.generated_at}`)
  lines.push(`Duration: ${elapsedSec}s`)
  lines.push("")
  lines.push("## Summary")
  lines.push(`- Total findings: ${sortedFindings.length}`)
  lines.push(`- P0: ${reportJson.summary.by_severity.P0}`)
  lines.push(`- P1: ${reportJson.summary.by_severity.P1}`)
  lines.push(`- P2: ${reportJson.summary.by_severity.P2}`)
  lines.push(`- P3: ${reportJson.summary.by_severity.P3}`)
  lines.push(`- Coverage: pass=${counts.pass}, fail=${counts.fail}, skip=${counts.skip}, blocker=${counts.blocker}`)
  lines.push(`- Inventory: pages=${reportJson.summary.pages}, apis=${reportJson.summary.apis}`)
  lines.push("")

  lines.push("## Prioritized Findings")
  if (sortedFindings.length === 0) {
    lines.push("- No findings.")
  } else {
    for (const f of sortedFindings) {
      lines.push(`- [${f.severity}] [${f.category}] ${f.module} | ${f.route_or_api} | role=${f.role}`)
      lines.push(`  - Expected: ${f.expected}`)
      lines.push(`  - Actual: ${f.actual}`)
      lines.push(`  - Evidence: ${f.evidence}`)
      lines.push(`  - Repro: ${f.repro_steps.join(" -> ")}`)
    }
  }
  lines.push("")

  lines.push("## Route Coverage Matrix")
  lines.push("| Target | Type | Role | Status | Reason |")
  lines.push("|---|---|---|---|---|")
  for (const c of ctx.coverage) {
    lines.push(`| ${c.target} | ${c.type} | ${c.role} | ${c.status} | ${c.reason || ""} |`)
  }

  const mdPath = path.join(ctx.outputDir, "campaign-report.md")
  await fs.writeFile(mdPath, lines.join("\n"), "utf8")

  const invPath = path.join(ctx.outputDir, "route-inventory.json")
  await fs.writeFile(invPath, JSON.stringify(ctx.inventory, null, 2), "utf8")

  console.log(`Report written:`)
  console.log(`- ${path.relative(ctx.rootDir, mdPath)}`)
  console.log(`- ${path.relative(ctx.rootDir, jsonPath)}`)
  console.log(`- ${path.relative(ctx.rootDir, invPath)}`)
}

async function run() {
  const rootDir = process.cwd()
  const stamp = nowStamp()
  const outputDir = path.join(rootDir, envOptional("TEST_CAMPAIGN_OUTPUT_DIR") || "test-results", `campaign-${stamp}`)
  await fs.mkdir(outputDir, { recursive: true })

  const baseUrl = envOptional("STAGING_BASE_URL") || envOptional("NEXT_PUBLIC_APP_URL") || "http://localhost:3000"
  const supabaseUrl = envRequired("NEXT_PUBLIC_SUPABASE_URL")
  const supabaseAnonKey = envRequired("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  const serviceRoleKey = envRequired("SUPABASE_SERVICE_ROLE_KEY")

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const ctx: CampaignContext = {
    rootDir,
    outputDir,
    baseUrl: baseUrl.replace(/\/$/, ""),
    supabaseUrl,
    supabaseAnonKey,
    serviceRoleKey,
    service,
    findings: [],
    coverage: [],
    startTime: Date.now(),
    inventory: [],
  }

  console.log(`Starting campaign against: ${ctx.baseUrl}`)
  console.log(`Supabase project ref: ${getProjectRef(ctx.supabaseUrl)}`)

  ctx.inventory = await buildInventory(rootDir)

  if (INVENTORY_ONLY) {
    await writeOutputs(ctx)
    return
  }

  const personas = await loadPersonas(ctx)
  await runDiagnosticsWithServiceRole(ctx)
  await runRbacDeepAudit(ctx)

  let baseReachable = true
  try {
    await fetch(`${ctx.baseUrl}/auth/login`, { redirect: "manual" })
  } catch (e: any) {
    baseReachable = false
    addCoverage(ctx, {
      target: ctx.baseUrl,
      type: "diagnostic",
      role: "system",
      status: "blocker",
      reason: `Base URL unreachable: ${e?.message || "unknown error"}`,
    })
    addFinding(ctx, {
      module: "environment",
      route_or_api: ctx.baseUrl,
      role: "system",
      severity: "P1",
      category: "Legacy",
      repro_steps: ["Verify STAGING_BASE_URL is correct and reachable from this machine."],
      expected: "Campaign target URL should be reachable before HTTP route/workflow checks.",
      actual: e?.message || "Failed to connect.",
      evidence: String(e),
      status: "blocker",
    })
  }

  if (baseReachable) {
    await runRouteAccessChecks(ctx, personas)
    await runWorkflowTests(ctx, personas)
  } else {
    addCoverage(ctx, {
      target: "route-access-checks",
      type: "diagnostic",
      role: "system",
      status: "skip",
      reason: "Skipped because base URL is unreachable.",
    })
    addCoverage(ctx, {
      target: "workflow-tests",
      type: "diagnostic",
      role: "system",
      status: "skip",
      reason: "Skipped because base URL is unreachable.",
    })
  }

  await runRlsNegativeTests(ctx, personas)
  await runUiStaticChecks(ctx)

  await writeOutputs(ctx)

  const failCount = ctx.coverage.filter((c) => c.status === "fail" || c.status === "blocker").length
  if (failCount > 0) {
    process.exitCode = 2
  }
}

run().catch((e) => {
  console.error("Campaign failed:", e)
  process.exitCode = 1
})
