"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  animate,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type Variants,
} from "framer-motion"
import { cn } from "@/lib/utils"

/**
 * Motion primitives for the /guide page — adapted from the Vertex site's
 * reveal / mask-text / spotlight set. Every primitive renders static content
 * when the viewer asks for reduced motion.
 */

const ease = [0.22, 1, 0.36, 1] as const

/** Fades, lifts and de-blurs its content the first time it scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
}: {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.8, ease, delay }}
    >
      {children}
    </motion.div>
  )
}

const staggerParent: Variants = {
  hidden: {},
  show: (stagger: number = 0.08) => ({ transition: { staggerChildren: stagger, delayChildren: 0.05 } }),
}

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease } },
}

/** Parent that reveals its <StaggerItem> children one after another. */
export function Stagger({
  children,
  className,
  stagger = 0.08,
}: {
  children: ReactNode
  className?: string
  stagger?: number
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      custom={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div className={className} variants={staggerChild}>
      {children}
    </motion.div>
  )
}

/**
 * Kinetic headline: each word rises out of its own clipping mask, staggered.
 * Screen readers get the plain sentence via aria-label; the split words are aria-hidden.
 */
export function MaskText({
  text,
  className,
  delay = 0,
  trigger = "inView",
  as = "h2",
}: {
  text: string
  className?: string
  delay?: number
  trigger?: "mount" | "inView"
  as?: "h1" | "h2" | "p"
}) {
  const reduce = useReducedMotion()
  if (reduce) {
    const Tag = as
    return <Tag className={className}>{text}</Tag>
  }

  const Comp = motion[as]
  const words = text.split(" ")
  const play =
    trigger === "mount" ? { animate: "show" } : { whileInView: "show", viewport: { once: true, amount: 0.6 } }

  return (
    <Comp className={className} aria-label={text} initial="hidden" {...play}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} aria-hidden className="inline-block overflow-hidden pb-[0.12em] align-top">
          <motion.span
            className="inline-block will-change-transform"
            variants={{
              hidden: { y: "110%", rotate: 3 },
              show: { y: "0%", rotate: 0, transition: { duration: 0.9, ease, delay: delay + i * 0.07 } },
            }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 && " "}
        </span>
      ))}
    </Comp>
  )
}

/**
 * Card with a primary-colour spotlight that follows the pointer and a slight
 * 3D tilt. Touch devices and reduced-motion viewers get the static card.
 */
export function SpotlightCard({
  children,
  className,
  tilt = 4,
}: {
  children: ReactNode
  className?: string
  tilt?: number
}) {
  const reduce = useReducedMotion()
  const mx = useMotionValue(-400)
  const my = useMotionValue(-400)
  const rx = useSpring(0, { stiffness: 160, damping: 20 })
  const ry = useSpring(0, { stiffness: 160, damping: 20 })
  const glow = useMotionTemplate`radial-gradient(360px circle at ${mx}px ${my}px, color-mix(in oklch, var(--primary) 22%, transparent), transparent 65%)`

  if (reduce) return <div className={cn("relative", className)}>{children}</div>

  return (
    <motion.div
      className={cn("group/spot relative isolate", className)}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return
        const r = e.currentTarget.getBoundingClientRect()
        const px = e.clientX - r.left
        const py = e.clientY - r.top
        mx.set(px)
        my.set(py)
        rx.set((py / r.height - 0.5) * -tilt)
        ry.set((px / r.width - 0.5) * tilt)
      }}
      onPointerLeave={() => {
        rx.set(0)
        ry.set(0)
        mx.set(-400)
        my.set(-400)
      }}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{ background: glow }}
      />
      {children}
    </motion.div>
  )
}

/** Counts up from 0 the first time it scrolls into view. */
export function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView || reduce) return
    const controls = animate(0, to, { duration: 1.3, ease: "easeOut", onUpdate: (v) => setValue(Math.round(v)) })
    return () => controls.stop()
  }, [inView, reduce, to])

  return (
    <span ref={ref}>
      {reduce ? to : value}
      {suffix}
    </span>
  )
}

/** Mono, uppercase section label with the slanted accent bar. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-primary flex items-center gap-3 font-mono text-xs tracking-[0.3em] uppercase", className)}>
      <span aria-hidden className="bg-primary h-0.5 w-8 -skew-x-[35deg]" />
      {children}
    </p>
  )
}
