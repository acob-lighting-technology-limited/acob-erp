import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { getSigningStatus, saveSignature, SigningError } from "@/lib/approval-signing/server"
import { requireSigningUser, signingErrorResponse } from "@/lib/approval-signing/route"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { getClientId, rateLimit } from "@/lib/rate-limit"

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"])

/**
 * POST /api/profile/signing/signature — multipart `file`: an uploaded image or
 * the PNG drawn on screen. Re-encoded to a trimmed PNG so only pixels are kept
 * (no metadata, no oversized originals).
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`signing-signature:${getClientId(request)}`, { limit: 10, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 })

  const auth = await requireSigningUser()
  if ("error" in auth) return auth.error

  try {
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) throw new SigningError("Choose or draw a signature first.", "bad_request")
    if (!ALLOWED_TYPES.has(file.type)) throw new SigningError("Upload a PNG, JPG or WebP image.", "bad_request")
    if (file.size > MAX_UPLOAD_BYTES) throw new SigningError("The image must be under 5 MB.", "bad_request")

    let png: Buffer
    try {
      png = await sharp(Buffer.from(await file.arrayBuffer()))
        .rotate()
        .trim()
        .resize(900, 300, { fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer()
    } catch {
      throw new SigningError("Could not read that image. Try a different file.", "bad_request")
    }

    await saveSignature(auth.admin, auth.user.id, png, "image/png")
    await writeAuditLog(
      auth.supabase,
      {
        action: "update",
        entityType: "approval_signature",
        entityId: auth.user.id,
        context: { actorId: auth.user.id, source: "api", route: "/api/profile/signing/signature" },
      },
      { failOpen: true }
    )
    return NextResponse.json({ data: await getSigningStatus(auth.admin, auth.user.id) })
  } catch (err) {
    return signingErrorResponse(err, "Failed to save signature")
  }
}
