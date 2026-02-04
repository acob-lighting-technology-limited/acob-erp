import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DocumentationContent } from "./documentation-content"

export interface Documentation {
  id: string
  title: string
  content: string
  category?: string
  tags?: string[]
  is_draft: boolean
  created_at: string
  updated_at: string
}

async function getDocumentationData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  const { data, error } = await supabase
    .from("user_documentation")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("Error loading documentation:", error)
  }

  return {
    docs: (data || []) as Documentation[],
    userId: user.id,
  }
}

export default async function DocumentationPage() {
  const data = await getDocumentationData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const docsData = data as { docs: Documentation[]; userId: string }

  return <DocumentationContent initialDocs={docsData.docs} userId={docsData.userId} />
}
