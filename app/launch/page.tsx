import { redirect } from "next/navigation"

// The public launch page was retired in favour of the in-app Matrix guide.
// Old links (welcome emails, bookmarks) land here; signed-out visitors are sent
// to the login screen by the /guide auth check.
export default function LaunchPage() {
  redirect("/guide")
}
