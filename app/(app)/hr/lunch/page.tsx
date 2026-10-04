import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { loadMenusInRange, loadVotesForMenu } from "@/lib/hr/lunch-menu-server"
import {
  isVotingOpen,
  loadLunchSettings,
  lunchCostBreakdown,
  resolveVotingDeadline,
  LUNCH_LOOKAHEAD_DAYS,
  LUNCH_LOOKBACK_DAYS,
} from "@/lib/hr/lunch-voting"
import { toLocalISODate } from "@/lib/utils/date"
import { LunchContent, type LunchPollData } from "./lunch-content"

export const dynamic = "force-dynamic"

interface PageProps {
  /** `date` opens the poll on that menu day — WhatsApp share links land here. */
  searchParams?: Promise<{ tab?: string; date?: string }>
}

export default async function LunchPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const initialTab = resolvedSearchParams?.tab === "history" ? "history" : "poll"
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const dataClient = getServiceRoleClientOrFallback(supabase)
  const today = toLocalISODate()
  const shift = (days: number) => {
    const d = new Date(`${today}T12:00:00+01:00`)
    d.setDate(d.getDate() + days)
    return toLocalISODate(d)
  }

  const settings = await loadLunchSettings(dataClient)
  const menus = await loadMenusInRange(dataClient, shift(-LUNCH_LOOKBACK_DAYS), shift(LUNCH_LOOKAHEAD_DAYS))

  // A share link's day wins. Otherwise land on today when it has a menu, else
  // the next published day — voting usually happens a day or more ahead.
  const requested = resolvedSearchParams?.date ? menus.find((m) => m.date === resolvedSearchParams.date) : undefined
  const selected =
    requested || menus.find((m) => m.date === today) || menus.find((m) => m.date > today) || menus.at(-1) || null

  const votes = selected ? await loadVotesForMenu(dataClient, selected.id) : []
  const { cost, companySubsidy, employeeDeduction } = lunchCostBreakdown(settings)

  const initialData: LunchPollData = {
    today,
    selectedDate: selected?.date ?? today,
    days: menus.map((menu) => ({
      date: menu.date,
      menu_id: menu.id,
      votingOpen: isVotingOpen(menu, settings),
      deadline: resolveVotingDeadline(menu, settings).toISOString(),
    })),
    menu: selected,
    votes,
    votingOpen: selected ? isVotingOpen(selected, settings) : false,
    deadline: selected ? resolveVotingDeadline(selected, settings).toISOString() : null,
    pricing: { cost, company_subsidy: companySubsidy, employee_deduction: employeeDeduction },
    eatingDays: settings.eating_days,
  }

  return <LunchContent initialData={initialData} currentUserId={user.id} initialTab={initialTab} />
}
