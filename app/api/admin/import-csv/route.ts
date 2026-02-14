import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify user is admin
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    // Use service role key for admin operations
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log("[v0] Starting CSV import via admin API...")

    // Fetch CSV data from the provided URL
    const csvUrl =
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ACOB%20employee%20Details%20%28Responses%29s-w3SdRcPn4KaoAZk0lby8AEGY4Rzmri.csv"

    const response = await fetch(csvUrl)
    const csvText = await response.text()

    // Robust CSV parsing (handles quoted commas and escaped quotes)
    const parseCsv = (text: string): any[] => {
      const rows: string[] = []
      let cur = ""
      let inQuotes = false
      for (let i = 0; i < text.length; i++) {
        const c = text[i]
        const n = text[i + 1]
        if (c === '"') {
          if (inQuotes && n === '"') {
            cur += '"'
            i++
          } else {
            inQuotes = !inQuotes
          }
        } else if ((c === "\n" || c === "\r") && !inQuotes) {
          if (cur.length) rows.push(cur)
          cur = ""
          if (c === "\r" && n === "\n") i++
        } else {
          cur += c
        }
      }
      if (cur.length) rows.push(cur)

      const splitRow = (row: string): string[] => {
        const out: string[] = []
        let buf = ""
        let q = false
        for (let i = 0; i < row.length; i++) {
          const c = row[i]
          const n = row[i + 1]
          if (c === '"') {
            if (q && n === '"') {
              buf += '"'
              i++
            } else {
              q = !q
            }
          } else if (c === "," && !q) {
            out.push(buf)
            buf = ""
          } else {
            buf += c
          }
        }
        out.push(buf)
        return out.map((s) => s.trim())
      }

      if (rows.length === 0) return []
      const rawHeaders = splitRow(rows[0]).map((h) => h.replace(/^\uFEFF/, "").trim())
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "")
      const headerIdxByNorm: Record<string, number> = {}
      rawHeaders.forEach((h, idx) => (headerIdxByNorm[normalize(h)] = idx))

      const result: any[] = []
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r]
        if (!row || !row.trim()) continue
        const cols = splitRow(row)
        const rec: Record<string, string> = {}
        Object.entries(headerIdxByNorm).forEach(([norm, idx]) => {
          rec[norm] = (cols[idx] ?? "").trim()
        })
        result.push(rec)
      }
      return result
    }

    const records = parseCsv(csvText)

    console.log(`[v0] Parsed ${records.length} records from CSV`)

    // Filter and import only company emails
    let importedCount = 0
    let skippedCount = 0
    let errors: string[] = []

    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "")
    const get = (rec: any, headers: string[]): string => {
      for (const h of headers) {
        const key = norm(h)
        if (rec[key] !== undefined) return rec[key]
      }
      return ""
    }

    for (const record of records) {
      const originalEmailFromCsv = get(record, [
        "Company Email (or personal email if not available)",
        "Company Email",
        "Email",
      ])
        .toLowerCase()
        .trim()
      let email = originalEmailFromCsv

      // If personal or missing email, generate a company email using surname initial + '.' + first name
      const lastNameRaw = get(record, ["Last Name"]) || ""
      const firstNameRaw = get(record, ["First Name"]) || ""
      const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ")
      const lastName = normalizeName(lastNameRaw)
      const firstName = normalizeName(firstNameRaw)
      const isCompanyEmail = email.includes("@org.acoblighting.com") || email.includes("@acoblighting.com")
      if (!isCompanyEmail) {
        if (!lastName || !firstName) {
          console.log(`[v0] Skipping record without name to generate email: ${email}`)
          skippedCount++
          continue
        }
        const initial = lastName[0]
        const generated = `${initial}.${firstName}@org.acoblighting.com`
        email = generated.toLowerCase()
      }

      try {
        // Check if user already exists
        // Try locate existing profile by current company email first
        let { data: existingUser } = await serviceSupabase
          .from("profiles")
          .select("id")
          .eq("company_email", email)
          .single()

        // If not found and CSV had a personal email, try match on that personal email
        if (!existingUser && originalEmailFromCsv && originalEmailFromCsv !== email) {
          const { data: existingByPersonal } = await serviceSupabase
            .from("profiles")
            .select("id")
            .eq("company_email", originalEmailFromCsv)
            .single()
          if (existingByPersonal) existingUser = existingByPersonal
        }

        const first_name = get(record, ["First Name"]) || ""
        const last_name = get(record, ["Last Name"]) || ""
        const other_names = get(record, ["Other Names (Optional)"]) || ""
        const department = get(record, ["Department (if applicable)", "Department"]) || ""
        const company_role = get(record, ["Company Role"]) || ""
        const phone_number = get(record, ["Phone number", "Phone Number"]) || ""
        const residential_address = get(record, ["Residential Address"]) || ""
        const current_work_location =
          get(record, [
            "Current Work Location (Office or Site – indicate site name & state if Site)",
            "Current Work Location",
          ]) || ""
        const device_allocated = get(record, ["Device allocated", "Device allocated "]) || ""
        const device_type = get(record, ["Desktop/ Laptop", "Desktop / Laptop", "Desktop", "Laptop"]) || ""

        if (existingUser) {
          // Update missing fields on existing profile
          const updatePayload: Record<string, string> = {}
          const maybeSet = (key: string, value: string) => {
            if (value && value.length > 0) updatePayload[key] = value
          }
          // Ensure company email on profile is the generated/company one
          maybeSet("company_email", email)
          maybeSet("first_name", first_name)
          maybeSet("last_name", last_name)
          maybeSet("other_names", other_names)
          maybeSet("department", department)
          maybeSet("company_role", company_role)
          maybeSet("phone_number", phone_number)
          maybeSet("residential_address", residential_address)
          maybeSet("current_work_location", current_work_location)
          maybeSet("device_allocated", device_allocated)
          maybeSet("device_type", device_type)

          if (Object.keys(updatePayload).length > 0) {
            const { error: updateErr } = await serviceSupabase
              .from("profiles")
              .update(updatePayload)
              .eq("id", existingUser.id)

            if (updateErr) {
              console.log(`[v0] Update error for ${email}:`, updateErr.message)
              errors.push(`${email}: ${updateErr.message}`)
            } else {
              console.log(`[v0] Updated profile for: ${email}`)
            }
          } else {
            console.log(`[v0] User already exists with full data: ${email}`)
          }
          continue
        }

        // Create auth user
        const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
          email,
          password: Math.random().toString(36).slice(-12),
          email_confirm: true,
        })

        if (authError) {
          console.log(`[v0] Auth error for ${email}:`, authError.message)
          errors.push(`${email}: ${authError.message}`)
          continue
        }

        // Map fields with normalized header lookup
        // Insert profile
        const { error: profileError } = await serviceSupabase.from("profiles").insert({
          id: authData.user.id,
          company_email: email,
          first_name,
          last_name,
          other_names,
          department,
          company_role,
          phone_number,
          residential_address,
          current_work_location,
          device_allocated,
          device_type,
          is_admin: false,
        })

        if (profileError) {
          console.log(`[v0] Profile error for ${email}:`, profileError.message)
          errors.push(`${email}: ${profileError.message}`)
          continue
        }

        console.log(`[v0] Successfully imported: ${email}`)
        importedCount++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        console.log(`[v0] Error processing ${email}:`, errorMessage)
        errors.push(`${email}: ${errorMessage}`)
      }
    }

    const summary = {
      imported: importedCount,
      skipped: skippedCount,
      total: records.length,
      errors: errors.slice(0, 10), // Return first 10 errors
      errorCount: errors.length,
    }

    console.log(`[v0] Import complete. Imported: ${importedCount}, Skipped: ${skippedCount}, Errors: ${errors.length}`)

    return NextResponse.json(
      {
        success: true,
        message: `Import complete. Imported: ${importedCount}, Skipped: ${skippedCount}`,
        ...summary,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[v0] CSV import failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}
