import { toast } from "sonner"

/**
 * Share a requisition's link: the phone's share sheet when there is one, otherwise
 * the link is copied. The link opens the requisition for people who can view it.
 */
export async function shareRequisition(title: string, path: string) {
  const url = `${window.location.origin}${path}`
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url })
      return
    } catch (err) {
      // The person closed the share sheet: nothing to do.
      if (err instanceof DOMException && err.name === "AbortError") return
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    toast.success("Link copied")
  } catch {
    toast.error("Could not copy the link")
  }
}
