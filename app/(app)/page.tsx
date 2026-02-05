import { redirect } from "next/navigation"

// Root page redirects to profile (middleware handles this, but fallback here)
export default function RootPage() {
  redirect("/profile")
}
