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
          <div className="flex gap-2">
            <Link href="/auth/login" className="flex-1">
              <Button className="h-11 w-full text-base">Back to Login</Button>
            </Link>
            <Link href="/auth/sign-up" className="flex-1">
              <Button variant="outline" className="h-11 w-full bg-transparent text-base">
                Sign Up
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
