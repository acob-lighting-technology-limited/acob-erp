"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: "w-full",
        months: "flex w-full flex-col gap-4",
        month: "space-y-4",
        month_caption: "relative flex items-center justify-between pt-1",
        caption_label: "pointer-events-none absolute left-1/2 -translate-x-1/2 text-sm font-medium",
        nav: "flex w-full items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 border-border/80 bg-background/80 p-0 opacity-90 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 border-border/80 bg-background/80 p-0 opacity-90 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "grid w-full grid-cols-7",
        weekday: "text-muted-foreground rounded-md text-center font-normal text-[0.8rem]",
        week: "mt-2 flex w-full",
        day: "relative flex-1 p-0 text-center text-sm",
        day_button: cn(buttonVariants({ variant: "ghost" }), "h-10 w-full p-0 font-normal"),
        selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        today: "",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-40",
        hidden: "invisible",
        range_start: "rounded-l-md bg-primary text-primary-foreground",
        range_middle: "bg-muted text-foreground",
        range_end: "rounded-r-md bg-primary text-primary-foreground",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...iconProps }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("h-4 w-4", className)} {...iconProps} />
          ) : (
            <ChevronRight className={cn("h-4 w-4", className)} {...iconProps} />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
