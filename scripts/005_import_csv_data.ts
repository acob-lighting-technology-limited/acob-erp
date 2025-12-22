import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function importCSVData() {
  try {
    console.log("[v0] Starting CSV import...")

    // Fetch CSV data from the provided URL
    // Replace with your actual CSV URL containing employee data
    const csvUrl = process.env.CSV_IMPORT_URL || "YOUR_CSV_URL_HERE"

    if (csvUrl === "YOUR_CSV_URL_HERE") {
      throw new Error("Please set CSV_IMPORT_URL environment variable with your CSV data URL")
    }

    const response = await fetch(csvUrl)
    const csvText = await response.text()

    // Parse CSV
    const lines = csvText.split("\n")
    const headers = lines[0].split(",").map((h) => h.trim())

    console.log("[v0] CSV Headers:", headers)

    const records: any[] = []

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue

      const values = lines[i].split(",").map((v) => v.trim())
      const record: any = {}

      headers.forEach((header, index) => {
        record[header] = values[index] || ""
      })

      records.push(record)
    }

    console.log(`[v0] Parsed ${records.length} records from CSV`)

    // Filter and import only company emails
    let importedCount = 0
    let skippedCount = 0

    for (const record of records) {
      const email = record["Company Email (or personal email if not available)"]?.toLowerCase().trim()

      // Skip if email is not a company email
      if (!email || (!email.includes("@org.acoblighting.com") && !email.includes("@acoblighting.com"))) {
        console.log(`[v0] Skipping personal email: ${email}`)
        skippedCount++
        continue
      }

      try {
        // Check if user already exists
        const { data: existingUser } = await supabase.from("profiles").select("id").eq("company_email", email).single()

        if (existingUser) {
          console.log(`[v0] User already exists: ${email}`)
          continue
        }

        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password: Math.random().toString(36).slice(-12),
          email_confirm: true,
        })

        if (authError) {
          console.log(`[v0] Auth error for ${email}:`, authError.message)
          continue
        }

        // Insert profile
        const { error: profileError } = await supabase.from("profiles").insert({
          id: authData.user.id,
          company_email: email,
          first_name: record["First Name"] || "",
          last_name: record["Last Name"] || "",
          other_names: record["Other Names (Optional)"] || "",
          department: record["Department (if applicable)"] || "",
          company_role: record["Company Role"] || "",
          phone_number: record["Phone number"] || "",
          residential_address: record["Residential Address"] || "",
          current_work_location:
            record["Current Work Location (Office or Site – indicate site name & state if Site)"] || "",
          device_allocated: record["Device allocated"] || "",
          device_type: record["Desktop/ Laptop"] || "",
          is_admin: false,
        })

        if (profileError) {
          console.log(`[v0] Profile error for ${email}:`, profileError.message)
          continue
        }

        console.log(`[v0] Successfully imported: ${email}`)
        importedCount++
      } catch (error) {
        console.log(`[v0] Error processing ${email}:`, error)
      }
    }

    console.log(`[v0] Import complete. Imported: ${importedCount}, Skipped: ${skippedCount}`)
  } catch (error) {
    console.error("[v0] CSV import failed:", error)
  }
}

importCSVData()
