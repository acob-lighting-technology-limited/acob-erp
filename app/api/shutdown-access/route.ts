import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    // Get the shutdown password from environment variable
    const shutdownPassword = process.env.SHUTDOWN_ACCESS_PASSWORD || "admin123"

    if (!password || password !== shutdownPassword) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      )
    }

    // Set bypass cookie - valid for 30 days
    const cookieStore = await cookies()
    cookieStore.set("shutdown_bypass", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    )
  }
}

