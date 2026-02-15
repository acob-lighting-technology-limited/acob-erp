import { neon } from "@neondatabase/serverless"

// This script imports employee data from the CSV into the pending_users table
// Run this after the database schema is created

const sql = neon(process.env.DATABASE_URL!)

// Example CSV data structure - replace with actual data when importing
const csvData = [
  {
    lastName: "Doe",
    firstName: "John",
    otherNames: "Smith",
    deviceAllocated: "HP",
    desktopLaptop: "Desktop",
    department: "Technical",
    companyRole: "Technical Support",
    companyEmail: "john.doe@acoblighting.com",
    phoneNumber: "+2348012345678",
    residentialAddress: "123 Example Street, Lagos",
    currentWorkLocation: "Office",
    siteName: "Head Office",
    siteState: "Lagos State",
  },
  {
    lastName: "Smith",
    firstName: "Jane",
    otherNames: "",
    deviceAllocated: "Dell",
    desktopLaptop: "Laptop",
    department: "Operations",
    companyRole: "Operations Manager",
    companyEmail: "jane.smith@acoblighting.com",
    phoneNumber: "+2349087654321",
    residentialAddress: "456 Sample Avenue, Abuja",
    currentWorkLocation: "Site",
    siteName: "Project Site A",
    siteState: "FCT",
  },
  // Add more rows from CSV as needed
]

async function importCSV() {
  try {
    console.log("[v0] Starting CSV import...")

    for (const row of csvData) {
      const result = await sql`
        INSERT INTO public.pending_users (
          first_name,
          last_name,
          other_names,
          device_allocated,
          device_type,
          department,
          company_role,
          email,
          phone_number,
          residential_address,
          current_work_location
        )
        VALUES (
          ${row.firstName},
          ${row.lastName},
          ${row.otherNames},
          ${row.deviceAllocated},
          ${row.desktopLaptop},
          ${row.department},
          ${row.companyRole},
          ${row.companyEmail},
          ${row.phoneNumber},
          ${row.residentialAddress},
          ${row.currentWorkLocation},
          ${row.siteName},
          ${row.siteState}
        )
        ON CONFLICT (email) DO NOTHING`

      console.log(`[v0] Imported: ${row.firstName} ${row.lastName} (${row.companyEmail})`)
    }

    console.log("[v0] CSV import completed successfully!")
  } catch (error) {
    console.error("[v0] Error importing CSV:", error)
    throw error
  }
}

importCSV()
