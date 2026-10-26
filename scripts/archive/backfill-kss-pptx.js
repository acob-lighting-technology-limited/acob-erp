const fs = require("fs")
const { createClient } = require("@supabase/supabase-js")

const envText = fs.readFileSync(".env.local", "utf-8")
const env = {}
envText.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (match) {
    let val = match[2] || ""
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
    env[match[1]] = val.trim()
  }
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const tenant = env.AZURE_TENANT_ID
const client = env.AZURE_CLIENT_ID
const secret = env.AZURE_CLIENT_SECRET
const siteHostname = env.ONEDRIVE_SITE_HOSTNAME
const sitePath = env.ONEDRIVE_SITE_PATH

async function run() {
  console.log("--- Starting KSS PPTX to PDF Backfill ---")

  // 1. Fetch token
  console.log("1. Authenticating with Microsoft Graph...")
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client,
      client_secret: secret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  })
  const { access_token } = await tokenRes.json()
  if (!access_token) throw new Error("Failed to obtain Graph access token")

  // 2. Resolve SharePoint site & reports drive
  const siteRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteHostname}:${sitePath}`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  const site = await siteRes.json()

  const drivesRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${site.id}/drives`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  const drives = await drivesRes.json()
  const reportsDrive = drives.value.find((d) => d.name === "reports") || drives.value[0]
  console.log(`Found reports drive: ${reportsDrive.name} (id: ${reportsDrive.id})`)

  // 3. Query all KSS records with PPTX
  const { data: rows, error } = await supabase
    .from("meeting_week_documents")
    .select("*")
    .eq("document_type", "knowledge_sharing_session")
    .like("file_name", "%.pptx%")
    .order("meeting_week", { ascending: false })

  if (error) throw error
  console.log(`Found ${rows.length} PPTX records to backfill:`)

  for (const row of rows) {
    console.log(`\nProcessing Week ${row.meeting_week} (${row.file_name})...`)
    const relPath = row.file_path.replace(/^\/reports\//, "")
    const itemUrl = `https://graph.microsoft.com/v1.0/drives/${reportsDrive.id}/root:/${encodeURIComponent(relPath)}`

    const itemRes = await fetch(itemUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!itemRes.ok) {
      console.warn(`  Item not found on OneDrive at ${relPath}: ${itemRes.statusText}`)
      continue
    }
    const item = await itemRes.json()
    console.log(`  Found OneDrive item: ${item.name} (${item.size} bytes)`)

    // Convert via Graph ?format=pdf
    console.log(`  Converting to PDF via Microsoft Graph...`)
    const convertUrl = `https://graph.microsoft.com/v1.0/drives/${reportsDrive.id}/items/${item.id}/content?format=pdf`
    const convertRes = await fetch(convertUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!convertRes.ok) {
      console.error(`  Conversion failed with status ${convertRes.status}: ${await convertRes.text()}`)
      continue
    }

    const pdfBuffer = Buffer.from(await convertRes.arrayBuffer())
    console.log(`  Converted PDF received! (${pdfBuffer.length} bytes)`)

    // Upload converted PDF to same OneDrive directory
    const newRelPath = relPath.replace(/\.pptx$/i, ".pdf")
    const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${reportsDrive.id}/root:/${encodeURIComponent(newRelPath)}:/content`
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/pdf",
      },
      body: pdfBuffer,
    })

    if (!uploadRes.ok) {
      console.error(`  Failed to upload converted PDF to OneDrive: ${uploadRes.status}`)
      continue
    }
    console.log(`  Uploaded converted PDF to OneDrive at: ${newRelPath}`)

    // Mirror to Supabase storage bucket `meeting_documents`
    const supabaseStoragePath = newRelPath
    await supabase.storage
      .from("meeting_documents")
      .upload(supabaseStoragePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      })
      .catch(() => null)

    // Update database row
    const newFileName = row.file_name.replace(/\.pptx$/i, ".pdf")
    const newFilePath = row.file_path.replace(/\.pptx$/i, ".pdf")

    const { error: updateError } = await supabase
      .from("meeting_week_documents")
      .update({
        file_name: newFileName,
        file_path: newFilePath,
        mime_type: "application/pdf",
      })
      .eq("id", row.id)

    if (updateError) {
      console.error(`  Failed to update database for ${row.id}:`, updateError)
    } else {
      console.log(`  DB updated successfully: ${newFileName} (application/pdf)`)
    }
  }

  console.log("\n--- Backfill complete! ---")
}

run().catch(console.error)
