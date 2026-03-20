"use client"

import { useState } from "react"
import { CircleHelp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ResponsiveModal } from "@/components/ui/patterns/responsive-modal"

interface ItemInfoDetail {
  label: string
  value: string
}

interface ItemInfoButtonProps {
  title: string
  summary: string
  details: ItemInfoDetail[]
  triggerLabel?: string
}

export function ItemInfoButton({
  title,
  summary,
  details,
  triggerLabel = "What does this mean?",
}: ItemInfoButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground h-7 w-7"
            onClick={() => setOpen(true)}
            aria-label={triggerLabel}
          >
            <CircleHelp className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{triggerLabel}</TooltipContent>
      </Tooltip>

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={summary}
        desktopClassName="max-w-2xl"
      >
        <div className="space-y-3">
          {details.map((detail) => (
            <Card key={`${detail.label}-${detail.value.slice(0, 24)}`} className="border">
              <CardContent className="space-y-1 p-4">
                <div className="text-sm font-semibold">{detail.label}</div>
                <p className="text-muted-foreground text-sm leading-6">{detail.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </ResponsiveModal>
    </>
  )
}
