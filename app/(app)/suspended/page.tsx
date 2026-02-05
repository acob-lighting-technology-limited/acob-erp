"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Calendar, Clock, LogOut, Mail, Phone, User } from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"
import type { EmployeeSuspension } from "@/types/hr"

interface SuspensionData {
  reason: string
  start_date: string
  end_date: string | null
  suspended_by_name?: string
}

export default function SuspendedPage() {
  const [loading, setLoading] = useState(true)
  const [suspension, setSuspension] = useState<SuspensionData | null>(null)
  const [userName, setUserName] = useState("")
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadSuspensionData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          router.push("/auth/login")
          return
        }

        // Get user's profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, employment_status")
          .eq("id", user.id)
          .single()

        if (profile) {
          setUserName(`${profile.first_name} ${profile.last_name}`)

          // If not suspended, redirect to profile
          if (profile.employment_status !== "suspended") {
            router.push("/profile")
            return
          }
        }

        // Get active suspension details
        const { data: suspensionData } = await supabase
          .from("employee_suspensions")
          .select(
            `
            reason,
            start_date,
            end_date,
            suspended_by
          `
          )
          .eq("employee_id", user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .single()

        if (suspensionData) {
          // Get the name of who suspended them
          let suspendedByName = "HR Department"
          if (suspensionData.suspended_by) {
            const { data: suspender } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("id", suspensionData.suspended_by)
              .single()

            if (suspender) {
              suspendedByName = `${suspender.first_name} ${suspender.last_name}`
            }
          }

          setSuspension({
            reason: suspensionData.reason,
            start_date: suspensionData.start_date,
            end_date: suspensionData.end_date,
            suspended_by_name: suspendedByName,
          })
        }
      } catch (error) {
        console.error("Error loading suspension data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadSuspensionData()
  }, [supabase, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950 dark:to-orange-950">
        <div className="animate-pulse">
          <AlertTriangle className="h-16 w-16 text-amber-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4 dark:from-amber-950 dark:to-orange-950">
      <Card className="w-full max-w-lg border-amber-200 shadow-xl dark:border-amber-800">
        <CardHeader className="pb-2 text-center">
          <div className="mx-auto mb-4 w-fit rounded-full bg-amber-100 p-4 dark:bg-amber-900/50">
            <AlertTriangle className="h-12 w-12 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl text-amber-800 dark:text-amber-200">Account Suspended</CardTitle>
          <CardDescription className="text-amber-700 dark:text-amber-300">
            {userName && `Hello ${userName.split(" ")[0]}, `}Your access to the ERP system has been temporarily
            suspended.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {suspension && (
            <>
              {/* Suspension Reason */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/30">
                <h3 className="mb-2 flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                  Reason for Suspension
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">{suspension.reason}</p>
              </div>

              {/* Suspension Period */}
              <div className="grid gap-3">
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-muted-foreground">Started:</span>
                  <span className="font-medium">{format(new Date(suspension.start_date), "MMMM d, yyyy")}</span>
                  <Badge variant="outline" className="text-xs">
                    {formatDistanceToNow(new Date(suspension.start_date), { addSuffix: true })}
                  </Badge>
                </div>

                {suspension.end_date ? (
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-muted-foreground">Expected End:</span>
                    <span className="font-medium">{format(new Date(suspension.end_date), "MMMM d, yyyy")}</span>
                    <Badge variant="secondary" className="text-xs">
                      {formatDistanceToNow(new Date(suspension.end_date), { addSuffix: true })}
                    </Badge>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-muted-foreground">Duration:</span>
                    <Badge variant="destructive" className="text-xs">
                      Indefinite
                    </Badge>
                  </div>
                )}

                {suspension.suspended_by_name && (
                  <div className="flex items-center gap-3 text-sm">
                    <User className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-muted-foreground">Suspended by:</span>
                    <span className="font-medium">{suspension.suspended_by_name}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Contact Information */}
          <div className="bg-muted/50 rounded-lg border p-4">
            <h3 className="mb-3 font-medium">Need Help?</h3>
            <p className="text-muted-foreground mb-3 text-sm">
              If you have questions about your suspension, please contact the HR department.
            </p>
            <div className="flex flex-col gap-2 text-sm">
              <a href="mailto:hr@acoblighting.com" className="text-primary flex items-center gap-2 hover:underline">
                <Mail className="h-4 w-4" />
                hr@acoblighting.com
              </a>
              <a href="tel:+2348000000000" className="text-primary flex items-center gap-2 hover:underline">
                <Phone className="h-4 w-4" />
                +234 800 000 0000
              </a>
            </div>
          </div>

          {/* Logout Button */}
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
