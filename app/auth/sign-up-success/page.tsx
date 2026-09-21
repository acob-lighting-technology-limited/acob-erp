import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthShell, authCardClassName } from "@/components/auth/auth-shell"
import Link from "next/link"

export default function SignUpSuccessPage() {
  return (
    <AuthShell>
      <Card className={authCardClassName}>
        <CardHeader className="space-y-3 pb-6 text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">Check Your Email</CardTitle>
          <CardDescription className="text-base">We&apos;ve sent you a confirmation link</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Please check your email inbox and click the confirmation link to verify your account. Once confirmed, you
            can log in to access the employee portal.
          </p>
          <p className="text-muted-foreground text-sm">
            If you don&apos;t see the email, check your spam folder or try signing up again.
          </p>
          <Link href="/auth/login" className="block">
            <Button className="h-11 w-full text-base font-semibold">Back to Login</Button>
          </Link>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
