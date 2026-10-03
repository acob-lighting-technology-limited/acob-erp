import Link from "next/link"
import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { ArrowRight, Bell, CalendarOff, CheckCircle2, Clock, ListTodo, Sun, UtensilsCrossed } from "lucide-react"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { formatDate, formatRelative, formatTime } from "@/lib/format"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { loadAwayToday, loadMyAttendance, loadMyLunch, loadMyTasks, loadNeedsYou } from "@/lib/my-day/load"
import { toLocalISODate } from "@/lib/utils/date"

export const metadata: Metadata = {
  title: "My Day | Matrix",
  description: "What needs you today: attendance, approvals, tasks, lunch and who is away.",
}

function SectionCard({
  title,
  icon: Icon,
  href,
  linkLabel,
  count,
  children,
}: {
  title: string
  icon: React.ElementType
  href?: string
  linkLabel?: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="text-muted-foreground h-4 w-4" aria-hidden />
          {title}
          {count ? (
            <Badge variant="destructive" className="px-1.5 text-xs">
              {count}
            </Badge>
          ) : null}
        </CardTitle>
        {href && linkLabel ? (
          <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
            <Link href={href}>
              {linkLabel}
              <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1 pt-0">{children}</CardContent>
    </Card>
  )
}

function Quiet({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground py-4 text-center text-sm">{children}</p>
}

type CardProps = { supabase: SupabaseClient; userId: string }

/** Same footprint as a loaded card, so nothing jumps when it streams in. */
function CardSkeleton({ title, icon }: { title: string; icon: React.ElementType }) {
  return (
    <SectionCard title={title} icon={icon}>
      <div className="space-y-2 py-1" aria-busy>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </SectionCard>
  )
}

async function AttendanceCard({ supabase, userId }: CardProps) {
  const attendance = await loadMyAttendance(supabase, userId)
  return (
    <SectionCard title="Attendance" icon={Clock} href="/hr/attendance" linkLabel="Open">
      {attendance?.clockIn ? (
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2">
            <CheckCircle2 className="text-success-foreground h-4 w-4" aria-hidden />
            Clocked in at <span className="font-semibold">{formatTime(attendance.clockIn)}</span>
          </p>
          <p className="text-muted-foreground">
            {attendance.clockOut ? `Clocked out at ${formatTime(attendance.clockOut)}` : "Not clocked out yet"}
          </p>
        </div>
      ) : (
        <Quiet>No clock-in recorded today.</Quiet>
      )}
    </SectionCard>
  )
}

async function NeedsYouCard({ supabase, userId }: CardProps) {
  const needsYou = await loadNeedsYou(supabase, userId)
  return (
    <SectionCard title="Needs you" icon={Bell} href="/notifications" linkLabel="All" count={needsYou.count}>
      {needsYou.items.length === 0 ? (
        <Quiet>Nothing is waiting on you.</Quiet>
      ) : (
        <ul className="divide-y">
          {needsYou.items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.link || "/notifications"}
                className="hover:bg-muted/40 -mx-2 block rounded-md px-2 py-2 transition-colors"
              >
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {formatRelative(item.createdAt)} · {item.message}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

async function TasksCard({ supabase, userId }: CardProps) {
  const tasks = await loadMyTasks(supabase, userId)
  return (
    <SectionCard title="My tasks" icon={ListTodo} href="/tasks" linkLabel="All tasks">
      {tasks.length === 0 ? (
        <Quiet>No open tasks.</Quiet>
      ) : (
        <ul className="divide-y">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0 truncate text-sm">{task.title}</span>
              {task.dueDate ? (
                <Badge variant={task.overdue ? "destructive" : "outline"} className="shrink-0 text-xs">
                  {task.overdue ? "Overdue" : `Due ${formatDate(task.dueDate)}`}
                </Badge>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

async function LunchCard({ supabase, userId }: CardProps) {
  const lunch = await loadMyLunch(supabase, userId)
  return (
    <SectionCard
      title="Lunch"
      icon={UtensilsCrossed}
      href="/hr/lunch"
      linkLabel={lunch && !lunch.voted ? "Vote" : "Open"}
    >
      {!lunch ? (
        <Quiet>No menu published for today.</Quiet>
      ) : lunch.voted ? (
        <p className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="text-success-foreground h-4 w-4" aria-hidden />
          Your choice for today is in.
        </p>
      ) : (
        <p className="text-sm">
          Today&apos;s menu is open.
          {lunch.deadline ? (
            <span className="text-muted-foreground"> Vote by {formatTime(lunch.deadline)}.</span>
          ) : null}
        </p>
      )}
    </SectionCard>
  )
}

async function AwayCard({ supabase, userId }: CardProps) {
  const away = await loadAwayToday(supabase, userId)
  return (
    <SectionCard title="Away today" icon={CalendarOff} href="/calendar" linkLabel="Calendar">
      {away.length === 0 ? (
        <Quiet>Everyone is in today.</Quiet>
      ) : (
        <ul className="divide-y">
          {away.map((person) => (
            <li key={person.userId} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="truncate">{person.name}</span>
              <span className="text-muted-foreground shrink-0 text-xs">back after {formatDate(person.until)}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

/**
 * "My Day" (audit 2.2): the staff landing page. One glance answers "what do I
 * need to do today?" The shell renders at once and each card streams in on its
 * own (audit 8.7), so one slow query never holds up the rest.
 */
export default async function MyDayPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/home")

  const firstName = (user.user_metadata?.first_name as string | undefined)?.trim()
  const props = { supabase, userId: user.id }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title={firstName ? `Good day, ${firstName}` : "My Day"}
        description={formatDate(toLocalISODate())}
        icon={Sun}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Suspense fallback={<CardSkeleton title="Attendance" icon={Clock} />}>
          <AttendanceCard {...props} />
        </Suspense>
        <Suspense fallback={<CardSkeleton title="Needs you" icon={Bell} />}>
          <NeedsYouCard {...props} />
        </Suspense>
        <Suspense fallback={<CardSkeleton title="My tasks" icon={ListTodo} />}>
          <TasksCard {...props} />
        </Suspense>
        <Suspense fallback={<CardSkeleton title="Lunch" icon={UtensilsCrossed} />}>
          <LunchCard {...props} />
        </Suspense>
        <Suspense fallback={<CardSkeleton title="Away today" icon={CalendarOff} />}>
          <AwayCard {...props} />
        </Suspense>
      </div>
    </PageWrapper>
  )
}
