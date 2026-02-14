import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Check Your Email</CardTitle>
            <CardDescription>We&apos;ve sent you a confirmation link</CardDescription>
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
              <Button className="w-full">Back to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
