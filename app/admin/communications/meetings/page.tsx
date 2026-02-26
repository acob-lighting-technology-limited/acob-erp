"use client"

import { PageWrapper, PageHeader } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Megaphone, ChevronRight, CalendarDays } from "lucide-react"
import Link from "next/link"

export default function CommunicationsMeetingsPage() {
  const cards = [
    {
      title: "Meeting Mailings",
      description: "Send meeting packs (weekly reports + action tracker) one-time or recurring.",
      href: "/admin/communications/meetings/mail",
      icon: Mail,
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    },
    {
      title: "Meeting Reminders",
      description: "Send meeting and knowledge-sharing reminders with scheduling controls.",
      href: "/admin/communications/meetings/reminders",
      icon: Megaphone,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
    },
  ]

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Communications: Meetings"
        description="Meeting-specific communication workflows."
        icon={CalendarDays}
        backLink={{ href: "/admin/communications", label: "Back to Communications" }}
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.title} href={card.href} className="group">
            <Card className="hover:border-primary h-full border-2 transition-all hover:shadow-lg">
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div
                  className={`${card.bgColor} ${card.color} flex h-12 w-12 items-center justify-center rounded-lg transition-transform group-hover:scale-110`}
                >
                  <card.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <CardTitle className="group-hover:text-primary text-xl transition-colors">{card.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription className="text-sm leading-relaxed">{card.description}</CardDescription>
                <div className="text-primary flex translate-x-[-10px] items-center text-sm font-medium opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
                  Open <ChevronRight className="ml-1 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </PageWrapper>
  )
}
