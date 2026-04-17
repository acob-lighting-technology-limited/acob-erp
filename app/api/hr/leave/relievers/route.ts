import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listAssignableProfiles } from "@/lib/workforce/assignment-policy"

type AssignableProfileRow = {
  id: string
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await listAssignableProfiles(supabase, {
      select: "id, full_name, first_name, last_name, employment_status",
      allowLegacyNullStatus: true,
      excludeUserId: user.id,
      orderBy: "first_name",
    })

    if (error) return NextResponse.json({ error: "Failed to fetch relievers" }, { status: 500 })

    const options = ((data || []) as AssignableProfileRow[])
      .map((person) => {
        const label =
          person.full_name?.trim() || `${person.first_name || ""} ${person.last_name || ""}`.trim() || "Unnamed"
        return { value: person.id, label }
      })
      .filter((option) => Boolean(option.value))

    return NextResponse.json({ data: options })
  } catch {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
