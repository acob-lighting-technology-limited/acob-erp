"use client"

import { useEffect, useRef, type CSSProperties } from "react"

/**
 * WireframeForms — a rotating 3D wireframe drawn on a plain <canvas>.
 *
 * Native port of the 21st.dev "Wireframe Forms" effect. The original rendered a
 * full HTML document in a sandboxed iframe that pulled Tailwind, GSAP and
 * iconify from CDNs — all blocked by this app's CSP (`script-src 'self'`) — so
 * the projection engine is reimplemented here with no external dependencies.
 *
 * Variants:
 *   - "matrix"    : a 3×3 adjacency matrix of the top-level Matrix modules around the core,
 *                   with data pulses travelling along the links
 *   - "cube"      : interlocking tetrahedra (original "Prismatic Core")
 *   - "sphere"    : nested icosahedra (original "Kinetic Frequency")
 */

type Mode = "dark" | "light"
type Vec3 = { x: number; y: number; z: number }
type Edge = [number, number, "ink" | "accent" | "faint"]
type Label = { point: number; text: string; core: boolean }
/** A pulse route between two labels (indices into `labels`). */
type Link = [number, number]

type Geometry = {
  points: Vec3[]
  edges: Edge[]
  labels: Label[]
  links: Link[]
  /** Half the largest extent, used to fit the shape to the canvas. */
  radius: number
  /** Rock back and forth instead of spinning, so text stays readable. */
  rock: boolean
}

export type WireframeFormsProps = {
  variant?: "matrix" | "cube" | "sphere"
  mode?: Mode
  /** Animation speed multiplier (0–3). */
  speed?: number
  /** Scale of the shape relative to the canvas (0.3–1.5). */
  size?: number
  className?: string
  style?: CSSProperties
}

const PALETTE: Record<Mode, { ink: string; accent: string }> = {
  dark: { ink: "255, 255, 255", accent: "74, 222, 128" },
  light: { ink: "15, 23, 42", accent: "22, 163, 74" },
}

/** Reading order; the centre cell is the Matrix core every module connects through. */
const MATRIX_MODULES = [
  "HR",
  "PMS",
  "ACCOUNTS",
  "TASKS",
  "MATRIX",
  "PROJECTS",
  "REPORTS",
  "HELP DESK",
  "CORRESPONDENCE",
]

function buildMatrix(): Geometry {
  const points: Vec3[] = []
  const edges: Edge[] = []
  const labels: Label[] = []
  const links: Link[] = []
  const size = 3
  const cell = 104
  const depth = 9
  const span = (size - 1) * cell
  const core = 4

  const add = (x: number, y: number, z: number) => points.push({ x, y, z }) - 1

  // Module nodes on the front plane, each with a shallow back-plane twin for depth.
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const index = r * size + c
      const x = -span / 2 + c * cell
      const y = -span / 2 + r * cell
      const f = add(x, y, -depth)
      add(x, y, depth)
      labels.push({ point: f, text: MATRIX_MODULES[index], core: index === core })
      // Orthogonal neighbours only — diagonals turned the grid into a spiderweb.
      if (c > 0) {
        edges.push([labels[index - 1].point, f, "faint"])
        links.push([index - 1, index])
      }
      if (r > 0) {
        edges.push([labels[index - size].point, f, "faint"])
        links.push([index - size, index])
      }
    }
  }

  // Thin flat brackets on the front plane. Extruding them read as grey slabs.
  const bracketX = span / 2 + cell * 0.46
  const bracketY = span / 2 + cell * 0.34
  const serif = cell * 0.16
  for (const side of [-1, 1]) {
    const x = side * bracketX
    const outline: [number, number][] = [
      [x - side * serif, -bracketY],
      [x, -bracketY],
      [x, bracketY],
      [x - side * serif, bracketY],
    ]
    const idx = outline.map(([px, py]) => add(px, py, -depth))
    for (let k = 0; k < idx.length - 1; k++) edges.push([idx[k], idx[k + 1], "accent"])
  }

  return { points, edges, labels, links, radius: Math.max(bracketX, bracketY) + depth, rock: true }
}

function buildCube(): Geometry {
  const s = 80
  const points: Vec3[] = [
    { x: s, y: s, z: s },
    { x: -s, y: -s, z: s },
    { x: -s, y: s, z: -s },
    { x: s, y: -s, z: -s },
    { x: -s, y: -s, z: -s },
    { x: s, y: s, z: -s },
    { x: s, y: -s, z: s },
    { x: -s, y: s, z: s },
  ]
  const pairs: [number, number][] = [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [1, 3],
    [2, 3],
    [4, 5],
    [4, 6],
    [4, 7],
    [5, 6],
    [5, 7],
    [6, 7],
  ]
  return {
    points,
    edges: pairs.map(([a, b], i) => [a, b, i < 6 ? "ink" : "accent"]),
    labels: [],
    links: [],
    radius: s * Math.SQRT2,
    rock: false,
  }
}

function buildSphere(): Geometry {
  const t = (1 + Math.sqrt(5)) / 2
  const s = 50
  const base = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ]
  const points: Vec3[] = [
    ...base.map(([x, y, z]) => ({ x: x * s, y: y * s, z: z * s })),
    ...base.map(([x, y, z]) => ({ x: x * s * 0.5, y: y * s * 0.5, z: z * s * 0.5 })),
  ]
  const edges: Edge[] = []
  const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
  for (let i = 0; i < 12; i++) {
    for (let j = i + 1; j < 12; j++) {
      if (dist(points[i], points[j]) < s * 2.1) edges.push([i, j, "ink"])
      if (dist(points[12 + i], points[12 + j]) < s * 1.1) edges.push([12 + i, 12 + j, "accent"])
    }
    edges.push([i, 12 + i, "faint"])
  }
  return { points, edges, labels: [], links: [], radius: s * Math.hypot(1, t), rock: false }
}

export default function WireframeForms({
  variant = "matrix",
  mode = "dark",
  speed = 1,
  size = 1,
  className,
  style,
}: WireframeFormsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const geometry = variant === "cube" ? buildCube() : variant === "sphere" ? buildSphere() : buildMatrix()
    const colors = PALETTE[mode]
    const safeSpeed = Math.min(3, Math.max(0, speed))
    const safeSize = Math.min(1.5, Math.max(0.3, size))
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let width = 0
    let height = 0
    let frame = 0
    let elapsed = 0
    let last = performance.now()

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      if (width === 0 || height === 0) return

      const angleY = geometry.rock ? Math.sin(elapsed * 0.3) * 0.22 : elapsed * 0.3
      const angleX = geometry.rock ? Math.sin(elapsed * 0.21) * 0.1 - 0.03 : elapsed * 0.12
      const cosY = Math.cos(angleY)
      const sinY = Math.sin(angleY)
      const cosX = Math.cos(angleX)
      const sinX = Math.sin(angleX)
      const fit = ((Math.min(width, height) / 2) * 0.82 * safeSize) / geometry.radius
      const fov = 700
      const cx = width / 2
      const cy = height / 2

      const projected = geometry.points.map((p) => {
        const x = p.x * cosY - p.z * sinY
        let z = p.z * cosY + p.x * sinY
        const y = p.y * cosX - z * sinX
        z = z * cosX + p.y * sinX
        const scale = fov / (fov + z)
        return { x: x * scale * fit + cx, y: y * scale * fit + cy, z, scale }
      })

      const depthAlpha = (z: number) => Math.max(0.15, Math.min(1, 1 - z / (geometry.radius * 2)))

      ctx.lineWidth = Math.max(0.75, fit * 1.1)
      for (const [a, b, tone] of geometry.edges) {
        const p1 = projected[a]
        const p2 = projected[b]
        const alpha = depthAlpha((p1.z + p2.z) / 2)
        const rgb = tone === "accent" ? colors.accent : colors.ink
        const strength = tone === "accent" ? 0.85 : tone === "ink" ? 0.4 : 0.12
        ctx.strokeStyle = `rgba(${rgb}, ${alpha * strength})`
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }

      if (geometry.labels.length > 0) {
        // Two staggered data pulses, each hopping along a pseudo-random link per cycle.
        // Derived from `elapsed` alone so a paused (reduced-motion) frame is stable.
        const glow = new Array<number>(geometry.labels.length).fill(0)
        const hopSeconds = 1.3
        for (const lane of [0, 0.5]) {
          const t = elapsed / hopSeconds + lane
          const slot = Math.floor(t)
          const progress = t - slot
          const hash = Math.abs(Math.sin((slot + lane * 7) * 12.9898) * 43758.5453)
          const [a, b] = geometry.links[Math.floor(hash) % geometry.links.length]
          const [from, to] = Math.floor(hash * 10) % 2 === 0 ? [a, b] : [b, a]
          const p1 = projected[geometry.labels[from].point]
          const p2 = projected[geometry.labels[to].point]
          const eased = progress * progress * (3 - 2 * progress)
          const x = p1.x + (p2.x - p1.x) * eased
          const y = p1.y + (p2.y - p1.y) * eased

          const trail = ctx.createLinearGradient(p1.x, p1.y, x, y)
          trail.addColorStop(0, `rgba(${colors.accent}, 0)`)
          trail.addColorStop(1, `rgba(${colors.accent}, 0.7)`)
          ctx.strokeStyle = trail
          ctx.lineWidth = Math.max(1, fit * 1.8)
          ctx.beginPath()
          ctx.moveTo(p1.x, p1.y)
          ctx.lineTo(x, y)
          ctx.stroke()

          ctx.fillStyle = `rgba(${colors.accent}, 0.95)`
          ctx.beginPath()
          ctx.arc(x, y, Math.max(2, 3 * fit), 0, Math.PI * 2)
          ctx.fill()

          glow[from] = Math.max(glow[from], 1 - progress * 2)
          glow[to] = Math.max(glow[to], (progress - 0.6) / 0.4)
        }

        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        geometry.labels.forEach(({ point, text, core }, index) => {
          const p = projected[point]
          const alpha = depthAlpha(p.z)
          const lit = Math.max(0, Math.min(1, glow[index]))
          const radius = Math.max(2.5, (core ? 6.5 : 4) * fit * p.scale)

          // Node: a ring, filled green while a pulse is leaving or arriving.
          ctx.lineWidth = Math.max(1, fit * 1.2)
          ctx.strokeStyle = `rgba(${core ? colors.accent : colors.ink}, ${alpha * (core ? 0.9 : 0.5)})`
          ctx.fillStyle = `rgba(${colors.accent}, ${alpha * (core ? 0.35 + 0.5 * lit : lit * 0.9)})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()

          // Long module names get a slight squeeze so neighbouring labels do not collide.
          const squeeze = Math.min(1, 10 / text.length)
          const fontSize = Math.max(8, (core ? 12 : 10) * squeeze * fit * p.scale)
          ctx.font = `${core ? 700 : 600} ${fontSize}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`
          const rgb = core || lit > 0.3 ? colors.accent : colors.ink
          ctx.fillStyle = `rgba(${rgb}, ${alpha * (core ? 0.95 : 0.55 + 0.4 * lit)})`
          ctx.fillText(text, p.x, p.y + radius + 6 * fit * p.scale)
        })
      } else {
        for (const p of projected) {
          const alpha = depthAlpha(p.z)
          if (alpha < 0.5) continue
          ctx.fillStyle = `rgba(${colors.ink}, ${alpha})`
          ctx.fillRect(p.x - 1, p.y - 1, 2, 2)
        }
      }
    }

    const tick = (now: number) => {
      const delta = Math.min(0.1, (now - last) / 1000)
      last = now
      elapsed += delta * safeSpeed
      draw()
      frame = requestAnimationFrame(tick)
    }

    resize()
    const observer = new ResizeObserver(() => {
      resize()
      draw()
    })
    observer.observe(canvas)

    if (reduceMotion || safeSpeed === 0) {
      elapsed = 1.2
      draw()
    } else {
      frame = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [variant, mode, speed, size])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}
    />
  )
}
