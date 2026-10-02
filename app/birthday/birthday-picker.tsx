"use client"

/* eslint-disable @next/next/no-img-element -- static asset, not optimizable by next/image */

import { ArrowLeft, Loader2, PartyPopper } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MONTHS, WEEK_OPTIONS, type Mode } from "./birthday-utils"
import type { BirthdayCelebrantsState } from "./use-birthday-celebrants"

/** The "choose a period" card every spotlight design opens with. */
export function BirthdayPicker({ state }: { state: BirthdayCelebrantsState }) {
  const s = state
  return (
    <div className="birthday-setup-container">
      <div className="birthday-setup-card">
        <img
          src="/images/acob-logo-dark.webp"
          alt="ACOB Lighting Logo"
          className="birthday-logo birthday-logo--setup"
        />

        <div className="text-center">
          <h2 className="birthday-script">Birthday Spotlight</h2>
          <p className="birthday-setup-lead">
            Pick a period and we&apos;ll roll out the confetti for everyone celebrating.
          </p>
        </div>

        <div className="birthday-picker">
          <Tabs value={s.mode} onValueChange={(v) => s.setMode(v as Mode)}>
            <TabsList className="birthday-tabs grid grid-cols-4">
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="range">Range</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="birthday-picker__controls">
            {s.mode === "day" && (
              <Input
                type="date"
                value={s.dayValue}
                onChange={(e) => s.setDayValue(e.target.value)}
                className="w-full"
              />
            )}
            {s.mode === "week" && (
              <div className="flex w-full gap-2">
                <Select value={String(s.weekNumber)} onValueChange={(v) => s.setWeekNumber(Number(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEK_OPTIONS.map((week) => (
                      <SelectItem key={week} value={String(week)}>
                        Week {week}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(s.weekYear)} onValueChange={(v) => s.setWeekYear(Number(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {s.yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {s.mode === "month" && (
              <Select value={s.monthValue} onValueChange={s.setMonthValue}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((name, i) => (
                    <SelectItem key={name} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {s.mode === "range" && (
              <div className="flex w-full items-center gap-2">
                <Input type="date" value={s.rangeStart} onChange={(e) => s.setRangeStart(e.target.value)} />
                <span className="birthday-muted text-xs">to</span>
                <Input type="date" value={s.rangeEnd} onChange={(e) => s.setRangeEnd(e.target.value)} />
              </div>
            )}
          </div>

          <Button onClick={s.generate} disabled={s.isLoading} className="birthday-cta w-full gap-2">
            {s.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PartyPopper className="h-4 w-4" />}
            Let&apos;s celebrate
          </Button>
        </div>
        {s.error && <p className="birthday-error">{s.error}</p>}
      </div>
    </div>
  )
}

export function BirthdayBackButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="fixed top-6 right-6 z-50">
      <Button onClick={onClick} variant="outline" size="sm" className="birthday-back gap-1.5">
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back</span>
      </Button>
    </div>
  )
}
