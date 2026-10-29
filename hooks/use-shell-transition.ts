"use client"

import { useReducedMotion, type Transition } from "framer-motion"

const SHELL_SPRING: Transition = { type: "spring", stiffness: 300, damping: 30 }

/** The sidebar and content-area width animation, skipped for people who ask their OS for reduced motion. */
export function useShellTransition(): Transition {
  return useReducedMotion() ? { duration: 0 } : SHELL_SPRING
}
