import { redirect } from "next/navigation"

// This route held a second, simpler leave form that skipped the balance check
// and the required-attachment rule, and nothing linked to it. Requests are made
// from the dialog on /hr/leave; old bookmarks land there.
export default function LeaveRequestPage() {
  redirect("/hr/leave")
}
