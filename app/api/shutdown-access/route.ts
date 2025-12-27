import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  console.log("=== SHUTDOWN ACCESS API CALLED ===")

  try {
    console.log("1. Parsing request body...")
    const body = await request.json()
    console.log("2. Request body parsed:", { hasPassword: !!body.password, passwordLength: body.password?.length })

    const { password } = body

    // Get the shutdown password from environment variable
    const shutdownPassword = process.env.SHUTDOWN_ACCESS_PASSWORD || "admin123"
    console.log("3. Environment check:", {
      hasEnvPassword: !!process.env.SHUTDOWN_ACCESS_PASSWORD,
      usingDefault: !process.env.SHUTDOWN_ACCESS_PASSWORD,
      expectedPasswordLength: shutdownPassword.length
    })

    if (!password) {
      console.log("4. ERROR: No password provided")
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      )
    }

    if (password !== shutdownPassword) {
      console.log("5. ERROR: Password mismatch", {
        providedLength: password.length,
        expectedLength: shutdownPassword.length,
        match: password === shutdownPassword
      })
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      )
    }

    console.log("6. Password validated successfully")

    // Set bypass cookie - valid for 30 days
    console.log("7. Setting bypass cookie...")
    const cookieStore = await cookies()

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    }

    console.log("8. Cookie options:", cookieOptions)

    cookieStore.set("shutdown_bypass", "true", cookieOptions)

    console.log("9. Bypass cookie set successfully")
    console.log("=== SHUTDOWN ACCESS SUCCESS ===")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("=== SHUTDOWN ACCESS ERROR ===")
    console.error("Error type:", error?.constructor?.name)
    console.error("Error message:", error instanceof Error ? error.message : String(error))
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")
    console.error("Full error object:", error)

    return NextResponse.json(
      {
        error: "An error occurred",
        details: error instanceof Error ? error.message : String(error),
        type: error?.constructor?.name
      },
      { status: 500 }
    )
  }
}
