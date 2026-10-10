"use client"

import Link from "next/link"
import { useId, useState } from "react"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Briefcase, Building2, MessageSquare, Plus, ShieldCheck, Ticket } from "lucide-react"
import { PageWrapper } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { CountUp, Eyebrow, MaskText, Reveal, SpotlightCard, Stagger, StaggerItem } from "@/components/guide/motion"
import {
  firstWeekSteps,
  guideFaqGroups,
  guideHighlights,
  guideModuleGroups,
  guideStats,
  guideStory,
  securityPoints,
  type GuideFaqGroup,
} from "@/lib/guide/content"
import { cn } from "@/lib/utils"

export type GuideExtraModule = {
  kind: "admin" | "dept" | "md-desk"
  name: string
  href: string
  summary: string
}

const extraIcons = { admin: ShieldCheck, dept: Building2, "md-desk": Briefcase } as const

function ModuleCard({
  name,
  href,
  summary,
  icon: Icon,
}: {
  name: string
  href: string
  summary: string
  icon: React.ElementType
}) {
  return (
    <SpotlightCard className="h-full rounded-xl">
      <Link
        href={href}
        className="group bg-card hover:border-primary/40 focus-visible:ring-ring flex h-full flex-col rounded-xl border p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="border-border bg-primary/10 flex size-10 items-center justify-center rounded-full border">
          <Icon className="text-primary size-5" aria-hidden />
        </span>
        <span className="mt-5 flex items-center justify-between gap-2 text-base font-semibold">
          {name}
          <ArrowRight
            className="text-muted-foreground group-hover:text-primary size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
        <span className="text-muted-foreground mt-1.5 text-sm">{summary}</span>
      </Link>
    </SpotlightCard>
  )
}

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const id = useId()
  const reduce = useReducedMotion()
  return (
    <div className={cn("border-b transition-colors", open && "border-primary/40")}>
      <h3>
        <button
          type="button"
          id={`${id}-q`}
          aria-expanded={open}
          aria-controls={`${id}-a`}
          onClick={onToggle}
          className="group flex w-full items-center justify-between gap-6 py-5 text-left"
        >
          <span
            className={cn(
              "text-base font-medium transition-colors sm:text-lg",
              open ? "text-foreground" : "text-foreground/85 group-hover:text-foreground"
            )}
          >
            {q}
          </span>
          <motion.span
            animate={{ rotate: open ? 135 : 0 }}
            transition={{ duration: reduce ? 0 : 0.4 }}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors",
              open ? "border-primary bg-primary text-primary-foreground" : "group-hover:border-primary"
            )}
          >
            <Plus className="size-4" aria-hidden />
          </motion.span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${id}-a`}
            role="region"
            aria-labelledby={`${id}-q`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.4 }}
            className="overflow-hidden"
          >
            <p className="text-muted-foreground max-w-2xl pb-6">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Topic tabs (sliding pill) + single-open accordion. */
function FaqAccordion({ groups }: { groups: GuideFaqGroup[] }) {
  const [active, setActive] = useState(groups[0]?.id ?? "")
  const [openQ, setOpenQ] = useState<string | null>(groups[0]?.items[0]?.q ?? null)
  const group = groups.find((g) => g.id === active) ?? groups[0]
  if (!group) return null

  return (
    <div className="grid gap-8 lg:grid-cols-[14rem_1fr]">
      <LayoutGroup id="guide-faq-tabs">
        <div
          role="tablist"
          aria-label="Question topics"
          className="flex gap-1 overflow-x-auto lg:sticky lg:top-24 lg:flex-col lg:self-start"
        >
          {groups.map((g) => {
            const on = g.id === active
            return (
              <button
                key={g.id}
                role="tab"
                aria-selected={on}
                type="button"
                onClick={() => {
                  setActive(g.id)
                  setOpenQ(g.items[0]?.q ?? null)
                }}
                className={cn(
                  "relative rounded-full px-4 py-2 text-left text-sm whitespace-nowrap transition-colors lg:rounded-lg",
                  on ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {on && (
                  <motion.span
                    layoutId="guide-faq-pill"
                    className="bg-muted absolute inset-0 rounded-[inherit]"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <span className="relative flex items-center justify-between gap-4">
                  {g.title}
                  <span className="text-muted-foreground font-mono text-xs">{g.items.length}</span>
                </span>
              </button>
            )
          })}
        </div>
      </LayoutGroup>

      <div role="tabpanel" className="border-t">
        {group.items.map((item) => (
          <FaqItem
            key={item.q}
            q={item.q}
            a={item.a}
            open={openQ === item.q}
            onToggle={() => setOpenQ(openQ === item.q ? null : item.q)}
          />
        ))}
      </div>
    </div>
  )
}

export function GuideContent({ firstName, extras }: { firstName: string | null; extras: GuideExtraModule[] }) {
  return (
    <PageWrapper maxWidth="full" background="plain" spacing="none" className="overflow-x-clip">
      {/* Hero */}
      <section className="bg-card relative isolate overflow-hidden rounded-2xl border px-5 py-14 sm:px-10 sm:py-20">
        <div
          aria-hidden
          className="absolute -top-40 -left-32 -z-10 size-[32rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_28%,transparent),transparent_70%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)] [background-size:48px_48px] opacity-40"
        />
        <Reveal y={12}>
          <Eyebrow>{firstName ? `Welcome, ${firstName}` : "Matrix guide"}</Eyebrow>
        </Reveal>
        <MaskText
          as="h1"
          trigger="mount"
          delay={0.1}
          text="One platform. Every operation."
          className="mt-5 max-w-4xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl"
        />
        <Reveal delay={0.3}>
          <p className="text-muted-foreground mt-6 max-w-2xl text-base sm:text-lg">
            Matrix is ACOB Lighting&apos;s workspace. Attendance, leave, pay, performance, tasks, projects, documents
            and support all live here, connected and behind one sign-in. This page explains what&apos;s where and how to
            get going.
          </p>
        </Reveal>
        <Reveal delay={0.4}>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href="#first-week">
                Start here <ArrowRight className="size-4" aria-hidden />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#modules">Your modules</a>
            </Button>
          </div>
        </Reveal>
      </section>

      {/* Stat band */}
      <Reveal className="mt-6">
        <dl className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border lg:grid-cols-4">
          {guideStats.map((s) => (
            <div key={s.label} className="bg-card p-5 sm:p-6">
              <dt className="text-muted-foreground text-sm">{s.label}</dt>
              <dd className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                {typeof s.value === "number" && s.value > 1 ? <CountUp to={s.value} suffix={s.suffix} /> : s.value}
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>

      {/* Why Matrix */}
      <section className="py-16 sm:py-24">
        <Reveal>
          <Eyebrow>Why Matrix</Eyebrow>
        </Reveal>
        <MaskText text="From scattered, to one." className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl" />
        <Stagger className="mt-10 grid gap-4 md:grid-cols-3" stagger={0.1}>
          {guideStory.map((s, i) => (
            <StaggerItem key={s.kicker}>
              <div
                className={cn(
                  "bg-card h-full rounded-xl border p-6",
                  i === guideStory.length - 1 && "border-primary/40 bg-primary/5"
                )}
              >
                <span className="text-primary font-mono text-xs tracking-[0.2em] uppercase">{s.kicker}</span>
                <p className="mt-4 text-lg font-semibold">{s.title}</p>
                <p className="text-muted-foreground mt-2 text-sm">{s.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Modules */}
      <section id="modules" className="scroll-mt-24 pb-16 sm:pb-24">
        <Reveal>
          <Eyebrow>Your modules</Eyebrow>
        </Reveal>
        <MaskText text="Everything you can open." className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl" />
        <Reveal delay={0.2}>
          <p className="text-muted-foreground mt-4 max-w-2xl">
            The same modules sit in the sidebar. Tap any card to go straight there.
          </p>
        </Reveal>

        {extras.length > 0 && (
          <div className="mt-10">
            <h3 className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">Your extra access</h3>
            <Stagger className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {extras.map((m) => (
                <StaggerItem key={m.href}>
                  <ModuleCard name={m.name} href={m.href} summary={m.summary} icon={extraIcons[m.kind]} />
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        )}

        {guideModuleGroups.map((group) => (
          <div key={group.key} className="mt-10">
            <h3 className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">{group.label}</h3>
            <Stagger className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.modules.map((m) => (
                <StaggerItem key={m.href}>
                  <ModuleCard name={m.name} href={m.href} summary={m.summary} icon={m.icon} />
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        ))}
      </section>

      {/* Inside the platform */}
      <section className="pb-16 sm:pb-24">
        <Reveal>
          <Eyebrow>Inside the platform</Eyebrow>
        </Reveal>
        <MaskText
          text="Built for how the work really happens."
          className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl"
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {guideHighlights.map((h, i) => (
            <Reveal key={h.tag} delay={(i % 2) * 0.1}>
              <div className="bg-card relative h-full overflow-hidden rounded-xl border p-6 sm:p-8">
                <h.icon aria-hidden className="text-primary/10 absolute -right-4 -bottom-4 size-32" />
                <span className="text-primary font-mono text-xs tracking-[0.2em] uppercase">{h.tag}</span>
                <p className="relative mt-4 text-xl font-semibold tracking-tight sm:text-2xl">{h.title}</p>
                <p className="text-muted-foreground relative mt-3 max-w-md text-sm sm:text-base">{h.body}</p>
                {h.href && (
                  <Link
                    href={h.href}
                    className="text-primary relative mt-5 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                  >
                    Open {h.tag.toLowerCase()} <ArrowRight className="size-4" aria-hidden />
                  </Link>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* First week */}
      <section id="first-week" className="scroll-mt-24 pb-16 sm:pb-24">
        <Reveal>
          <Eyebrow>Start here</Eyebrow>
        </Reveal>
        <MaskText
          text="Your first week in Matrix."
          className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl"
        />
        <Stagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.1}>
          {firstWeekSteps.map((step, i) => (
            <StaggerItem key={step.title}>
              <div className="bg-card flex h-full flex-col rounded-xl border p-6">
                <span className="text-primary font-mono text-sm">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-4 text-lg font-semibold">{step.title}</p>
                <p className="text-muted-foreground mt-2 flex-1 text-sm">{step.body}</p>
                {step.href && step.cta && (
                  <Link
                    href={step.href}
                    className="text-primary mt-5 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                  >
                    {step.cta} <ArrowRight className="size-4" aria-hidden />
                  </Link>
                )}
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* FAQ */}
      <section className="pb-16 sm:pb-24">
        <Reveal>
          <Eyebrow>Questions</Eyebrow>
        </Reveal>
        <MaskText text="Things people ask." className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl" />
        <Reveal delay={0.2} className="mt-10">
          <FaqAccordion groups={guideFaqGroups} />
        </Reveal>
      </section>

      {/* Security + help */}
      <section className="pb-8">
        <Reveal>
          <div className="bg-card relative isolate overflow-hidden rounded-2xl border px-5 py-12 text-center sm:px-10 sm:py-16">
            <div
              aria-hidden
              className="absolute -top-48 left-1/2 -z-10 size-[30rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_70%)]"
            />
            <Eyebrow className="justify-center">Secured by design</Eyebrow>
            <MaskText
              text="Need a hand? You're covered."
              className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl"
            />
            <p className="text-muted-foreground mx-auto mt-5 max-w-xl">
              Ask AcoBot for quick how-tos, or raise a Help Desk ticket when something isn&apos;t working. Your data
              stays protected the whole way.
            </p>
            <ul className="mt-6 flex flex-wrap justify-center gap-2">
              {securityPoints.map((point) => (
                <li key={point} className="bg-muted text-muted-foreground rounded-full border px-3 py-1 text-xs">
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/help-desk">
                  <Ticket className="size-4" aria-hidden /> Raise a ticket
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/tools/feedback">
                  <MessageSquare className="size-4" aria-hidden /> Send feedback
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </PageWrapper>
  )
}
