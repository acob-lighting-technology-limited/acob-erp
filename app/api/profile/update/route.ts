import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = {
      id: user.id,
      first_name: body.first_name ?? null,
      last_name: body.last_name ?? null,
      other_names: body.other_names ?? null,
      department: body.department ?? null,
      company_role: body.company_role ?? null,
      phone_number: body.phone_number ?? null,
      additional_phone: body.additional_phone ?? null,
      residential_address: body.residential_address ?? null,
      current_work_location: body.current_work_location ?? null,
      device_type: body.device_type ?? null,
      device_allocated: body.device_allocated ?? null,
      device_model: body.device_model ?? null,
      bank_name: body.bank_name ?? null,
      bank_account_number: body.bank_account_number ?? null,
      bank_account_name: body.bank_account_name ?? null,
      date_of_birth: body.date_of_birth ?? null,
      employment_date: body.employment_date ?? null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
