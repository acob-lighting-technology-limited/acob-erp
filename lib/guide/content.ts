import type { LucideIcon } from "lucide-react"
import {
  BookUser,
  CalendarDays,
  ClipboardList,
  FileBarChart,
  FileCode2,
  FileText,
  Landmark,
  Layers,
  LayoutDashboard,
  ShieldCheck,
  Ticket,
  Timer,
  Wallet,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react"

/**
 * Copy for the in-app Matrix guide (/guide). Kept apart from the page so the
 * wording can be edited without touching layout code. Module hrefs mirror the
 * staff sidebar (components/sidebar.tsx) — if a module moves there, move it here.
 */

export type GuideModule = {
  name: string
  href: string
  icon: LucideIcon
  summary: string
}

export type GuideModuleGroup = {
  key: string
  label: string
  modules: GuideModule[]
}

export const guideModuleGroups: GuideModuleGroup[] = [
  {
    key: "overview",
    label: "Overview",
    modules: [
      {
        name: "Dashboard",
        href: "/profile",
        icon: LayoutDashboard,
        summary: "Your home page: your profile, today's attendance and what needs your attention.",
      },
      {
        name: "Directory",
        href: "/directory",
        icon: BookUser,
        summary: "Find any colleague's department, role and contact details.",
      },
      {
        name: "Calendar",
        href: "/calendar",
        icon: CalendarDays,
        summary: "Company events, meetings and holidays you can attend.",
      },
    ],
  },
  {
    key: "management",
    label: "Management",
    modules: [
      {
        name: "HR",
        href: "/hr",
        icon: Users,
        summary: "Clock in and out, request leave, vote on lunch and book shared resources.",
      },
      {
        name: "PMS",
        href: "/pms",
        icon: TrendingUp,
        summary: "Your performance: goals, KPIs, reviews and the score they add up to.",
      },
      {
        name: "Accounts",
        href: "/accounts",
        icon: Landmark,
        summary: "Raise requisitions and track payments, payroll and assets assigned to you.",
      },
      {
        name: "Portfolios",
        href: "/portfolios",
        icon: Layers,
        summary: "Portfolios and the projects inside them, with progress and health.",
      },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    modules: [
      {
        name: "Tasks",
        href: "/tasks",
        icon: ClipboardList,
        summary: "Work assigned to you or your department, with due dates and status.",
      },
      {
        name: "Help Desk",
        href: "/help-desk",
        icon: Ticket,
        summary: "Raise a ticket when something is broken or you need support, and follow it to resolution.",
      },
      {
        name: "Reports",
        href: "/reports",
        icon: FileBarChart,
        summary: "General meeting records: weekly reports, action tracker, KSS, attendance and minutes.",
      },
      {
        name: "Correspondence",
        href: "/correspondence",
        icon: FileCode2,
        summary: "Official letters and memos, numbered and filed in one register.",
      },
      {
        name: "Documentation",
        href: "/documentation",
        icon: FileText,
        summary: "Company policies and SOPs, plus your personal and department documents.",
      },
      {
        name: "Tools",
        href: "/tools",
        icon: Wrench,
        summary: "Email signature, watermark studio, media and PDF suite, job description and feedback.",
      },
    ],
  },
]

/** Headline numbers carried over from the retired /launch page. */
export const guideStats: { value: number | string; suffix?: string; label: string }[] = [
  { value: 20, suffix: "+", label: "Connected modules" },
  { value: 1, label: "Secure workspace" },
  { value: 100, suffix: "%", label: "Paper trails, eliminated" },
  { value: "Live", label: "Across every department" },
]

export const guideStory: { kicker: string; title: string; body: string }[] = [
  {
    kicker: "Before",
    title: "A dozen systems",
    body: "Spreadsheets, paper forms and tools that never spoke to each other.",
  },
  {
    kicker: "The shift",
    title: "One secure grid",
    body: "Every workflow rebuilt into a single connected platform.",
  },
  {
    kicker: "Now",
    title: "Total visibility",
    body: "Leadership sees the whole organisation, live, at a glance.",
  },
]

export type GuideHighlight = {
  tag: string
  title: string
  body: string
  icon: LucideIcon
  href?: string
}

export const guideHighlights: GuideHighlight[] = [
  {
    tag: "Attendance & time",
    title: "Every clock-in, live. No manual registers.",
    body: "Staff clock themselves in, field teams are location-verified against approved sites, and managers see the roster update in real time.",
    icon: Timer,
    href: "/hr/attendance",
  },
  {
    tag: "Payroll",
    title: "Attendance flows straight into pay.",
    body: "Pay periods are calculated, reviewed and run from a single screen — accurate, auditable and on time, every cycle.",
    icon: Wallet,
    href: "/accounts/payroll",
  },
  {
    tag: "Performance",
    title: "One score, from everywhere performance shows up.",
    body: "KPIs, goals, attendance, CBT, behaviour and reviews roll into one live performance profile for every employee.",
    icon: TrendingUp,
    href: "/pms",
  },
  {
    tag: "Secured by design",
    title: "Nothing happens that can't be accounted for.",
    body: "Access is controlled by role, protected at the database itself, and important actions are written to a permanent audit trail.",
    icon: ShieldCheck,
  },
]

export const securityPoints = ["Role-based access", "Database-level security", "Full audit trail", "Network monitoring"]

export type GuideStep = {
  title: string
  body: string
  href?: string
  cta?: string
}

export const firstWeekSteps: GuideStep[] = [
  {
    title: "Complete your profile",
    body: "Add a clear photo and check your details. Colleagues find you through the directory, so keep it current.",
    href: "/settings/profile",
    cta: "Open profile settings",
  },
  {
    title: "Clock in every working day",
    body: "Attendance is recorded in Matrix and feeds payroll and your performance score, so lateness and missed days count.",
    href: "/hr/attendance",
    cta: "Go to attendance",
  },
  {
    title: "Turn on notifications",
    body: "Choose which alerts reach you by email and push. On iPhone, add Matrix to your Home Screen first to receive push alerts.",
    href: "/settings/notifications",
    cta: "Notification settings",
  },
  {
    title: "Check your tasks and goals",
    body: "Your tasks and goals are what your review is built from. Update their status as you work, not at the end of the quarter.",
    href: "/tasks",
    cta: "Open tasks",
  },
]

export type GuideFaq = { q: string; a: string }
export type GuideFaqGroup = { id: string; title: string; items: GuideFaq[] }

export const guideFaqGroups: GuideFaqGroup[] = [
  {
    id: "account",
    title: "Account & access",
    items: [
      {
        q: "Who can use Matrix?",
        a: "Every ACOB staff member with a company email address (@acoblighting.com or @org.acoblighting.com). New staff activate their account once at /auth/setup-account with a code sent to their email.",
      },
      {
        q: "I can't see a module a colleague can see.",
        a: "Modules and admin areas are shown by role. If you need access for your work, ask your department lead or raise a Help Desk ticket to ICT.",
      },
      {
        q: "How do I change my password?",
        a: "Go to Settings → Security. If you are locked out, use 'Forgot password' on the login screen.",
      },
    ],
  },
  {
    id: "daily",
    title: "Day to day",
    items: [
      {
        q: "How do I request leave?",
        a: "Open HR → Leave, choose the leave type and dates, and submit. Your request goes to your approvers and you are notified at each step. Your balance is shown on the same page.",
      },
      {
        q: "I forgot to clock in. What now?",
        a: "Speak to your department lead or HR the same day. Missed clock-ins affect your attendance record, payroll and performance score.",
      },
      {
        q: "Where do I submit my weekly report?",
        a: "Reports → General Meeting → Weekly. Submit before the general meeting so it is included.",
      },
    ],
  },
  {
    id: "help",
    title: "Getting help",
    items: [
      {
        q: "What is AcoBot?",
        a: "The assistant behind the round button in the bottom-right corner. Ask it how to do something in Matrix and it will point you to the right page.",
      },
      {
        q: "Something is broken. Who do I tell?",
        a: "Raise a Help Desk ticket with what you were doing and a screenshot if you can. Tickets are tracked, so nothing gets lost in a chat.",
      },
      {
        q: "Is my data private?",
        a: "Access is controlled by role and enforced in the database itself, and important actions are written to an audit trail. You see your own records; managers see what their role allows.",
      },
    ],
  },
]
