import Link from "next/link"
import { PenLine } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Shown at the top of "New requisition" when the person has no signature or PIN
 * yet. Submitting signs the form, so both are needed; saying so before they fill
 * anything in saves them finding out at the end. Setting up takes a minute, and
 * they come back here afterwards.
 */
export function SigningSetupNotice({
  hasSignature,
  hasPin,
  returnPath,
}: {
  hasSignature: boolean
  hasPin: boolean
  returnPath: string
}) {
  if (hasSignature && hasPin) return null
  const missing = [!hasSignature && "your signature", !hasPin && "an approval PIN"].filter(Boolean).join(" and ")
  return (
    <div role="alert" className="border-warning/30 bg-warning/10 space-y-2 rounded-md border p-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <PenLine className="h-4 w-4 shrink-0" />
        Set up {missing} before you raise a requisition
      </p>
      <ul className="text-muted-foreground list-disc space-y-0.5 pl-5 text-xs">
        {hasSignature ? null : <li>Your signature is printed on the form next to &ldquo;Requested by&rdquo;.</li>}
        {hasPin ? null : (
          <li>Your PIN (6 digits) confirms it is really you each time you sign. Pick one you will remember.</li>
        )}
        <li>It takes about a minute, once. You will be brought back here afterwards.</li>
      </ul>
      <Button asChild size="sm">
        <Link href={`/settings/signing?return=${encodeURIComponent(returnPath)}`}>Set up signature and PIN</Link>
      </Button>
    </div>
  )
}
