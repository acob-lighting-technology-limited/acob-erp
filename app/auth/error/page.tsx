import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthShell, authCardClassName } from "@/components/auth/auth-shell"
import Link from "next/link"
import { ErrorState } from "@/components/ui/patterns"

export default function AuthErrorPage() {
  return (
    <AuthShell>
      <Card className={authCardClassName}>
        <CardHeader className="space-y-3 pb-6 text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">Authentication Error</CardTitle>
          <CardDescription className="text-base">Something went wrong during authentication</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ErrorState
            title="Something went wrong during authentication"
            description="Please try again. If the problem persists, contact support."
            className="border-0 bg-transparent p-0"
          />
          {/* Public sign-up is disabled (see app/auth/sign-up), so login is the only way on from here. */}
          <Link href="/auth/login" className="block">
            <Button className="h-11 w-full text-base">Back to Login</Button>
          </Link>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
