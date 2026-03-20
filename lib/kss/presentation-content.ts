import type { ErpSceneConfig, SceneConfig } from "@/types/presentation"

const erpUrl = process.env.NEXT_PUBLIC_ERP_URL || "/"

export const erpSceneConfig: ErpSceneConfig = {
  url: erpUrl,
  fallbackMode: "handoff",
  displayUrl: erpUrl.replace(/^https?:\/\//, "") || "erp.acoblighting.com",
  loadingTitle: "Preparing the live ERP stage",
  loadingBody:
    "This panel reuses the same ACOB origin so the presentation can move directly into the live ERP experience.",
  blockedTitle: "ERP access needs a direct handoff",
  blockedBody:
    "If this route is protected or blocked in-frame, open the ERP directly and continue the walkthrough from the live system.",
  interactionTitle: "Live interaction is ready",
  interactionBody:
    "Use this stage to move through the ERP naturally and connect each screen back to the story the audience has already seen.",
  presenterChecklist: [
    "Log into the ERP in this same browser before the session starts.",
    "Frame the workflow before entering the live stage.",
    "Show one or two strong paths instead of trying to show everything.",
    "If a route resists framing, open it directly and continue without breaking pace.",
  ],
}

export const presentationScenes: SceneConfig[] = [
  {
    id: "opening",
    eyebrow: "ERP Knowledge Sharing Session",
    title: "ACOB ERP: why we built it, what it does, and how we use it.",
    body: "This presentation is about the ERP itself. It explains why ACOB built it, what business problems it solves, the core modules inside it, and how it supports day-to-day work across the company.",
    theme: "aurora",
    layout: "hero",
    metrics: [
      {
        label: "Presenter",
        value: "IT + Communications",
        description:
          "Presented from the perspective of the team helping to build, support, and communicate the system.",
      },
      {
        label: "Session goal",
        value: "Understand the ERP",
        description: "What it is, why it exists, what modules it contains, and how it improves work.",
      },
      {
        label: "Live component",
        value: "Real ERP walkthrough",
        description: "A live stage is included so the explanation can move straight into the actual product.",
      },
    ],
    quote: {
      text: "The goal of this KSS is simple: help everyone understand the ERP as a real working system, not just another internal tool.",
      author: "IT and Communications",
    },
  },
  {
    id: "agenda",
    eyebrow: "Session Agenda",
    title: "What this KSS will cover from start to finish.",
    body: "This session is structured to answer the most important ERP questions clearly: what it is, why it was developed, the modules it contains, how people use it, and what value it creates for the organization.",
    theme: "vault",
    layout: "insight",
    cards: [
      {
        title: "1. ERP overview",
        body: "What the system is and the role it plays inside ACOB Lighting and the wider organization.",
      },
      {
        title: "2. Why it was built",
        body: "The business and operational challenges the ERP was designed to solve.",
      },
      {
        title: "3. Modules and features",
        body: "The user-facing and admin-facing areas already available inside the platform.",
      },
      {
        title: "4. Live walkthrough",
        body: "A guided look at the actual ERP environment to connect explanation with practice.",
      },
    ],
  },
  {
    id: "why-built",
    eyebrow: "Why The ERP Was Built",
    title: "The ERP was built to solve fragmentation, delay, and weak operational visibility.",
    body: "Before a system like this, records, approvals, requests, and reporting can become scattered across emails, chats, paper trails, and isolated spreadsheets. The ERP was built to bring those processes into one controlled and visible environment.",
    theme: "ember",
    layout: "spotlight",
    bullets: [
      {
        title: "Operational fragmentation",
        body: "Important business processes can become split across too many channels and tools.",
      },
      {
        title: "Approval delays",
        body: "Requests move more slowly when progress depends on manual follow-up rather than a shared workflow.",
      },
      {
        title: "Poor visibility",
        body: "Leadership and teams struggle to see status clearly when information is not centralized.",
      },
      {
        title: "Weak traceability",
        body: "Without a system of record, it becomes harder to track actions, ownership, and outcomes over time.",
      },
    ],
  },
  {
    id: "what-is-erp",
    eyebrow: "What The ERP Is",
    title: "This ERP is ACOB's internal business operations platform.",
    body: "The ERP is not just one tool for one department. It is a shared platform used to support employee workflows, operational records, approvals, communication processes, reporting, and administration across the company.",
    theme: "lumen",
    layout: "insight",
    cards: [
      {
        title: "Central system",
        body: "It brings multiple operational functions into one connected environment.",
      },
      {
        title: "Business tool",
        body: "It supports actual company work, not just reporting or record storage.",
      },
      {
        title: "Workflow engine",
        body: "It helps requests move from submission to approval, action, and documented outcome.",
      },
      {
        title: "Visibility layer",
        body: "It gives teams and leadership clearer access to current status and historical activity.",
      },
    ],
    quote: {
      text: "The ERP should be understood as the company's operational backbone, not as a single feature or department page.",
      author: "KSS focus",
    },
  },
  {
    id: "modules",
    eyebrow: "Core Modules",
    title: "The ERP already covers a wide range of operational modules.",
    body: "From the current product structure, the ERP includes both user-facing and administrative areas that support different parts of business operations.",
    theme: "summit",
    layout: "spotlight",
    metrics: [
      {
        label: "Employee modules",
        value: "Attendance, leave, profile",
        description: "Supports staff-facing workflows and day-to-day employee interactions with the system.",
      },
      {
        label: "Operational modules",
        value: "Projects, tasks, reports",
        description: "Supports execution tracking, status visibility, and performance follow-up.",
      },
      {
        label: "Business modules",
        value: "Payments, assets, fleet",
        description: "Supports administrative and resource-related processes across the organization.",
      },
      {
        label: "Support modules",
        value: "Help desk, docs, comms",
        description: "Supports requests, internal documentation, and coordinated work across teams.",
      },
    ],
  },
  {
    id: "feature-groups",
    eyebrow: "Feature Groups",
    title: "The ERP combines staff services, operations, and admin control in one system.",
    body: "What makes this ERP important is not only the number of modules, but the fact that they live in one environment with shared access, shared records, and shared process visibility.",
    theme: "vault",
    layout: "insight",
    cards: [
      {
        title: "People and HR workflows",
        body: "Attendance, leave, employee records, profiles, and related approvals.",
      },
      {
        title: "Finance and payment workflows",
        body: "Payment records, finance-related approvals, and administrative oversight.",
      },
      {
        title: "Operations and execution",
        body: "Tasks, projects, fleet, assets, reports, and other execution-supporting areas.",
      },
      {
        title: "Administration and governance",
        body: "Admin panels, settings, reports, audit logs, users, permissions, and management tools.",
      },
    ],
  },
  {
    id: "workflow",
    eyebrow: "Typical ERP Workflow",
    title: "A strong ERP workflow moves from request to approval to action to record.",
    body: "Regardless of module, the general value of the ERP is that business activity follows a clearer and more traceable path inside the platform.",
    theme: "aurora",
    layout: "spotlight",
    bullets: [
      {
        title: "Submission",
        body: "A staff member or user creates a request, record, or operational item in the system.",
      },
      {
        title: "Review and approval",
        body: "The item moves to the relevant person or department for review, confirmation, or escalation.",
      },
      {
        title: "Execution",
        body: "The responsible team acts on it using the context already available in the ERP.",
      },
      {
        title: "Tracking and reporting",
        body: "The action and outcome remain visible for reference, reporting, and accountability.",
      },
    ],
  },
  {
    id: "it-comms-role",
    eyebrow: "Our Department's Role",
    title: "As IT and Communications, our role is to build trust in the ERP and help people understand it.",
    body: "This KSS is being presented from IT and Communications because the ERP is both a technical product and a communication challenge. People need to know how it works, why it matters, and how to use it with confidence.",
    theme: "lumen",
    layout: "insight",
    cards: [
      {
        title: "IT responsibility",
        body: "System readiness, support, user access, technical structure, and continuous improvement.",
      },
      {
        title: "Communications responsibility",
        body: "Clear explanation, internal awareness, adoption support, and making the value understandable.",
      },
      {
        title: "Shared responsibility",
        body: "Help colleagues see the ERP as useful, reliable, and aligned with real work.",
      },
      {
        title: "KSS purpose",
        body: "Turn familiarity into understanding and understanding into better adoption.",
      },
    ],
  },
  {
    id: "erp-stage",
    eyebrow: "Live ERP Walkthrough",
    title: "This is the point where the explanation becomes the real product.",
    body: "Use this scene to show the actual ERP environment. Move through the modules or workflow you want the audience to understand, and connect what they see back to the points already explained in the session.",
    theme: "lumen",
    layout: "erp",
    erpPath: "/",
  },
  {
    id: "admin-stage",
    eyebrow: "Live Admin Walkthrough",
    title: "This scene moves into the administrative side of the ERP.",
    body: "Use this page to show the management or administration flow directly inside the ERP so the audience can see the difference between user-facing work and admin control.",
    theme: "vault",
    layout: "erp",
    erpPath: "/admin",
  },
  {
    id: "benefits",
    eyebrow: "ERP Benefits",
    title: "The ERP improves clarity, speed, coordination, and accountability.",
    body: "The value of the ERP is not just digital convenience. It supports stronger process discipline, better information access, and better operational coordination across the business.",
    theme: "summit",
    layout: "insight",
    bullets: [
      {
        title: "Better visibility",
        body: "Teams and management can understand where work stands more easily.",
      },
      {
        title: "Better coordination",
        body: "Departments can hand work across the system with clearer structure and less confusion.",
      },
      {
        title: "Better accountability",
        body: "Actions, approvals, and records are easier to trace over time.",
      },
      {
        title: "Better reporting",
        body: "Operational data becomes easier to organize, review, and explain.",
      },
    ],
  },
  {
    id: "using-the-erp",
    eyebrow: "Using The ERP Well",
    title: "The ERP becomes most valuable when people use it consistently and correctly.",
    body: "Technology alone does not create value. The ERP helps most when people understand where to go, what to do there, and how their inputs affect the wider workflow.",
    theme: "aurora",
    layout: "spotlight",
    cards: [
      {
        title: "Use the right module",
        body: "Enter work through the correct area so records remain clean and meaningful.",
      },
      {
        title: "Follow process flow",
        body: "Respect the approval and workflow structure already built into the platform.",
      },
      {
        title: "Keep records accurate",
        body: "The quality of outputs depends on the quality and consistency of what users enter.",
      },
      {
        title: "Report issues early",
        body: "Feedback from users helps IT improve the ERP over time.",
      },
    ],
  },
  {
    id: "closing",
    eyebrow: "Closing",
    title: "The ERP is here to support better work across ACOB.",
    body: "This KSS is about helping everyone understand the ERP clearly: why it was built, what modules it contains, how workflows move through it, and why it matters to the business. The live system is the proof of that story.",
    theme: "vault",
    layout: "closing",
    bullets: [
      {
        title: "Presented by",
        body: "Chibuikem Ilonze, IT and Communications Department.",
      },
      {
        title: "Main message",
        body: "The ERP is a connected business platform built to improve how we work, track, and coordinate.",
      },
      {
        title: "After this session",
        body: "Use the ERP with more confidence, better understanding, and stronger awareness of its purpose.",
      },
    ],
  },
]
