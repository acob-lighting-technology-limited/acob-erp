import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { resolveCanonicalMeetingSetup, upsertCanonicalMeetingDate } from "@/lib/reports/meeting-date"

async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Ignore writes outside mutable response contexts.
        }
      },
    },
  })
}

function parseWeekYear(searchParams: URLSearchParams) {
  const meetingWeek = Number(searchParams.get("week") || "")
  const meetingYear = Number(searchParams.get("year") || "")

  if (!Number.isFinite(meetingWeek) || meetingWeek < 1 || meetingWeek > 53) {
    throw new Error("week must be between 1 and 53")
  }

  if (!Number.isFinite(meetingYear) || meetingYear < 2000 || meetingYear > 2100) {
    throw new Error("year must be between 2000 and 2100")
  }

  return { meetingWeek, meetingYear }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const { meetingWeek, meetingYear } = parseWeekYear(searchParams)
    const setup = await resolveCanonicalMeetingSetup(supabase, meetingWeek, meetingYear)

    return NextResponse.json({
      data: {
        meetingWeek,
        meetingYear,
        meetingDate: setup.meetingDate,
        meetingTime: setup.meetingTime,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve meeting date" },
      { status: 400 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const scope = await resolveAdminScope(supabase as any, user.id)
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const meetingWeek = Number(body?.meetingWeek)
    const meetingYear = Number(body?.meetingYear)
    const meetingDate = String(body?.meetingDate || "")
    const meetingTime = body?.meetingTime ? String(body.meetingTime) : null

    if (!Number.isFinite(meetingWeek) || meetingWeek < 1 || meetingWeek > 53) {
      return NextResponse.json({ error: "meetingWeek must be between 1 and 53" }, { status: 400 })
    }

    if (!Number.isFinite(meetingYear) || meetingYear < 2000 || meetingYear > 2100) {
      return NextResponse.json({ error: "meetingYear must be between 2000 and 2100" }, { status: 400 })
    }

    if (!meetingDate) {
      return NextResponse.json({ error: "meetingDate is required" }, { status: 400 })
    }

    const saved = await upsertCanonicalMeetingDate(supabase, {
      meetingWeek,
      meetingYear,
      meetingDate,
      meetingTime,
      actorId: user.id,
    })

    return NextResponse.json({
      data: {
        meetingWeek,
        meetingYear,
        meetingDate: saved.meetingDate,
        meetingTime: saved.meetingTime,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save meeting date" },
      { status: 400 }
    )
  }
}
