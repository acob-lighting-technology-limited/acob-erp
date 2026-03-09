import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ErrorState } from "@/components/ui/patterns"

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Authentication Error</CardTitle>
            <CardDescription>Something went wrong during authentication</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ErrorState
              title="Something went wrong during authentication"
              description="Please try again. If the problem persists, contact support."
              className="border-0 bg-transparent p-0"
            />
            <div className="flex gap-2">
              <Link href="/auth/login" className="flex-1">
                <Button className="w-full">Back to Login</Button>
              </Link>
              <Link href="/auth/sign-up" className="flex-1">
                <Button variant="outline" className="w-full bg-transparent">
                  Sign Up
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
