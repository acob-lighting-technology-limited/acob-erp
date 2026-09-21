"use client"

import { useEffect, useRef } from "react"

/**
 * GridTraces — streaks of light wander a graph-paper grid, turning at random
 * intersections, fading in where they start and out as they age, then
 * respawning elsewhere. No origin and no cycle, so there is no rhythm to catch.
 *
 * `cellSize` must match the CSS `background-size` of the grid underneath, and
 * the canvas must share that element's box, so the light rides visible lines.
 */

type Mode = "dark" | "light"

const ACCENT: Record<Mode, string> = {
  dark: "74, 222, 128",
  light: "22, 163, 74",
}

type Direction = [number, number]

const DIRECTIONS: Direction[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
]

type Trace = {
  col: number
  row: number
  dir: Direction
  /** Intersections already passed, forming the tail. */
  history: [number, number][]
  /** Progress toward the next intersection, 0 → 1. */
  t: number
  hops: number
  maxHops: number
  speed: number
}

function randomDirection(exclude?: Direction): Direction {
  const allowed = exclude ? DIRECTIONS.filter(([x, y]) => !(x === -exclude[0] && y === -exclude[1])) : DIRECTIONS
  return allowed[Math.floor(Math.random() * allowed.length)]
}

export type GridTracesProps = {
  /** Grid spacing in px; must match the grid this sits on. */
  cellSize?: number
  mode?: Mode
  /** How many streaks run at once. */
  count?: number
  /** Intersections kept in a streak's tail. */
  tailLength?: number
  /** Chance of turning at any given intersection. */
  turnChance?: number
  /** Peak line opacity. */
  opacity?: number
}

export default function GridTraces({
  cellSize = 44,
  mode = "dark",
  count = 7,
  tailLength = 5,
  turnChance = 0.34,
  opacity = 0.3,
}: GridTracesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const accent = ACCENT[mode]
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let width = 0
    let height = 0
    let cols = 0
    let rows = 0
    let frame = 0
    let last = performance.now()
    const traces: Trace[] = []

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      cols = Math.max(1, Math.floor(width / cellSize))
      rows = Math.max(1, Math.floor(height / cellSize))
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const spawnTrace = (): Trace => ({
      col: Math.floor(Math.random() * (cols + 1)),
      row: Math.floor(Math.random() * (rows + 1)),
      dir: randomDirection(),
      history: [],
      t: 0,
      hops: 0,
      maxHops: 8 + Math.floor(Math.random() * 10),
      speed: 0.7 + Math.random() * 0.7,
    })

    const draw = (now: number) => {
      const delta = Math.min(0.05, (now - last) / 1000) * 2.4
      last = now
      ctx.clearRect(0, 0, width, height)
      if (width === 0 || height === 0) return

      while (traces.length < count) traces.push(spawnTrace())

      for (let i = 0; i < traces.length; i++) {
        const trace = traces[i]
        trace.t += delta * trace.speed

        while (trace.t >= 1) {
          trace.t -= 1
          trace.history.push([trace.col, trace.row])
          if (trace.history.length > tailLength) trace.history.shift()
          trace.col += trace.dir[0]
          trace.row += trace.dir[1]
          trace.hops += 1

          const offGrid = trace.col < 0 || trace.col > cols || trace.row < 0 || trace.row > rows
          if (offGrid || trace.hops > trace.maxHops) {
            traces[i] = spawnTrace()
            break
          }
          if (Math.random() < turnChance) trace.dir = randomDirection(trace.dir)
        }

        const live = traces[i]
        if (live.history.length === 0) continue
        // Fade in over the first hops, out as the streak reaches its end.
        const fade = Math.min(1, live.hops / 2) * Math.max(0, 1 - live.hops / (live.maxHops + 1))
        if (fade <= 0.01) continue

        const points: [number, number][] = [
          ...live.history,
          [live.col, live.row],
          [live.col + live.dir[0] * live.t, live.row + live.dir[1] * live.t],
        ]

        ctx.lineCap = "round"
        ctx.lineWidth = 1.4
        for (let p = 1; p < points.length; p++) {
          // Brighter toward the head, so the tail trails off behind it.
          const weight = p / (points.length - 1)
          const alpha = opacity * 1.4 * fade * weight * weight
          if (alpha <= 0.01) continue
          ctx.strokeStyle = `rgba(${accent}, ${alpha})`
          ctx.beginPath()
          ctx.moveTo(points[p - 1][0] * cellSize, points[p - 1][1] * cellSize)
          ctx.lineTo(points[p][0] * cellSize, points[p][1] * cellSize)
          ctx.stroke()
        }

        const head = points[points.length - 1]
        ctx.fillStyle = `rgba(${accent}, ${opacity * 2.8 * fade})`
        ctx.beginPath()
        ctx.arc(head[0] * cellSize, head[1] * cellSize, 1.7, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const tick = (now: number) => {
      draw(now)
      frame = requestAnimationFrame(tick)
    }

    resize()
    const observer = new ResizeObserver(() => {
      resize()
      draw(performance.now())
    })
    observer.observe(canvas)

    if (reduceMotion) {
      // A single settled frame instead of constant movement.
      draw(performance.now())
    } else {
      frame = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [cellSize, mode, count, tailLength, turnChance, opacity])

  return <canvas ref={canvasRef} aria-hidden="true" style={{ display: "block", width: "100%", height: "100%" }} />
}
