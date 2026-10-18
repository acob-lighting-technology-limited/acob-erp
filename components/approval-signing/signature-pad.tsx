"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Eraser } from "lucide-react"

/**
 * Draw a signature with a finger, pen or mouse. Ink is always dark on a white
 * card so it reads on the printed form whatever the app theme.
 */
export function SignaturePad({ onChange }: { onChange: (blob: Blob | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  const resize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#111827"
    setHasInk(false)
    onChange(null)
  }, [onChange])

  useEffect(() => {
    resize()
  }, [resize])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const emit = () => {
    canvasRef.current?.toBlob((blob) => onChange(blob), "image/png")
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        aria-label="Signature drawing area"
        className="h-40 w-full touch-none rounded-md border border-dashed border-slate-400 bg-white"
        onPointerDown={(e) => {
          const ctx = e.currentTarget.getContext("2d")
          if (!ctx) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drawing.current = true
          const { x, y } = point(e)
          ctx.beginPath()
          ctx.moveTo(x, y)
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          const ctx = e.currentTarget.getContext("2d")
          if (!ctx) return
          const { x, y } = point(e)
          ctx.lineTo(x, y)
          ctx.stroke()
          if (!hasInk) setHasInk(true)
        }}
        onPointerUp={() => {
          if (!drawing.current) return
          drawing.current = false
          if (hasInk) emit()
        }}
        onPointerLeave={() => {
          if (drawing.current) {
            drawing.current = false
            if (hasInk) emit()
          }
        }}
      />
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">Sign inside the box.</p>
        <Button type="button" variant="ghost" size="sm" onClick={resize} disabled={!hasInk}>
          <Eraser className="mr-1.5 h-4 w-4" /> Clear
        </Button>
      </div>
    </div>
  )
}
