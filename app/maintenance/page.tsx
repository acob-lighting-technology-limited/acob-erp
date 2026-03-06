import { Wrench } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function MaintenancePage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-xl text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
            <Wrench className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
          </div>
          <CardTitle className="text-3xl">Under Maintenance</CardTitle>
          <CardDescription className="mx-auto max-w-lg text-base">
            We are currently performing scheduled maintenance to improve our services.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-8 sm:px-10 sm:pb-10">
          <p className="text-muted-foreground mb-5 text-lg">
            The system is temporarily unavailable. We apologize for the inconvenience and will be back shortly.
          </p>
          <p className="text-muted-foreground mb-3 text-base">
            Access is restricted to developer accounts during maintenance.
          </p>
          <p className="text-muted-foreground text-base">Please check back in a few minutes.</p>
        </CardContent>
      </Card>
    </div>
  )
}
