import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { HelpDeskContent } from "./help-desk-content"

async function getData() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { redirectTo: "/auth/login" as const }
  }

  const { data: tickets } = await supabase
    .from("help_desk_tickets")
    .select("*")
    .or(`requester_id.eq.${user.id},assigned_to.eq.${user.id}`)
    .order("created_at", { ascending: false })

  return { userId: user.id, tickets: tickets || [] }
}

export default async function PortalHelpDeskPage() {
  const data = await getData()

  if ("redirectTo" in data) {
    redirect(data.redirectTo || "/auth/login")
  }

  return <HelpDeskContent userId={data.userId} initialTickets={data.tickets as any} />
}
