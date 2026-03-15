import { createClient } from "@/lib/supabase/server"
import { resolveOneDriveAccessScope } from "@/lib/onedrive/access"
import type { Documentation } from "./page"

import { logger } from "@/lib/logger"

const log = logger("documentation-data")


export async function getDocumentationData() {
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
    log.error("Error loading documentation:", error)
  }

  const oneDriveScope = await resolveOneDriveAccessScope(supabase as any, user.id)

  return {
    docs: (data || []) as Documentation[],
    userId: user.id,
    departmentDocs: oneDriveScope
      ? {
          initialPath: oneDriveScope.defaultPath,
          rootLabel: oneDriveScope.rootLabel,
          enabled: true,
        }
      : {
          initialPath: "/Projects",
          rootLabel: "Projects",
          enabled: false,
        },
  }
}
