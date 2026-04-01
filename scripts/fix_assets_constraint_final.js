const { Client } = require("pg")
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") })

async function run() {
  const connectionString = process.env.SUPABASE_POSTGRES_URL_NON_POOLING
  if (!connectionString) {
    console.error("No SUPABASE_POSTGRES_URL_NON_POOLING found in .env.local")
    process.exit(1)
  }

  const client = new Client({ connectionString })
  try {
    console.log("Connecting to database...")
    await client.connect()

    console.log("Fixing constraint...")
    const query = `
      ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_department_check;
      ALTER TABLE public.assets ADD CONSTRAINT assets_department_check CHECK (
        department IS NULL OR department = ANY (ARRAY[
          'Accounts',
          'Admin & HR',
          'Business, Growth and Innovation',
          'Corporate Services',
          'Executive Management',
          'IT and Communications',
          'Legal, Regulatory and Compliance',
          'Logistics',
          'Monitoring and Evaluation',
          'Operations',
          'Project',
          'Technical'
        ])
      );
    `

    await client.query(query)
    console.log("✅ Success! Constraint fixed.")
  } catch (err) {
    console.error("❌ Error fixing constraint:", err)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
