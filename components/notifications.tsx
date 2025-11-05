"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Bell, AlertCircle, CheckCircle, Info, X, Clock, UserPlus, MessageSquare, ClipboardList, Laptop, ArrowRight } from "lucide-react"
import { useState } from "react"

interface Notification {
  id: string
  type: "info" | "warning" | "success" | "error"
  title: string
  message: string
  timestamp?: string
  link?: string
  linkText?: string
}

interface NotificationsProps {
  notifications: Notification[]
  title?: string
  showDismiss?: boolean
}

const notificationIcons = {
  info: Info,
  warning: AlertCircle,
  success: CheckCircle,
  error: AlertCircle,
}

const notificationColors = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

export function Notifications({ notifications, title = "Notifications", showDismiss = true }: NotificationsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  if (notifications.length === 0 || notifications.filter(n => !dismissed.has(n.id)).length === 0) {
    return null
  }

  const visibleNotifications = notifications.filter(n => !dismissed.has(n.id))

  const handleDismiss = (id: string) => {
    setDismissed(new Set([...Array.from(dismissed), id]))
  }

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
          {visibleNotifications.length > 0 && (
            <Badge variant="secondary">{visibleNotifications.length}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {visibleNotifications.map((notification) => {
          const Icon = notificationIcons[notification.type]
          return (
            <div
              key={notification.id}
              className={`p-4 rounded-lg border-l-4 ${
                notification.type === "info" ? "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20" :
                notification.type === "warning" ? "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20" :
                notification.type === "success" ? "border-l-green-500 bg-green-50 dark:bg-green-950/20" :
                "border-l-red-500 bg-red-50 dark:bg-red-950/20"
              } relative`}
            >
              {showDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-6 w-6 p-0"
                  onClick={() => handleDismiss(notification.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <div className="flex items-start gap-3 pr-8">
                <div className={`p-2 rounded-lg ${notificationColors[notification.type]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-semibold text-foreground text-sm">{notification.title}</h4>
                    {notification.timestamp && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {notification.timestamp}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                  {notification.link && (
                    <Link href={notification.link}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                        {notification.linkText || "View Details"}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
