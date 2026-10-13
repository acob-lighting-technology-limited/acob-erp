import { NextResponse } from "next/server"
import { getSigningStatus } from "@/lib/approval-signing/server"
import { requireSigningUser, signingErrorResponse } from "@/lib/approval-signing/route"

/** GET /api/profile/signing — the signed-in user's signature and PIN status. */
export async function GET() {
  const auth = await requireSigningUser()
  if ("error" in auth) return auth.error
  try {
    return NextResponse.json({ data: await getSigningStatus(auth.admin, auth.user.id) })
  } catch (err) {
    return signingErrorResponse(err, "Failed to load signing status")
  }
}
