"use client"

import { useEffect, useSyncExternalStore } from "react"
import type { NavChild } from "@/lib/nav/types"

export type NavPageSection = {
  label: string
  items: Array<{ name: string; href: string; icon?: React.ElementType; children?: NavChild[] }>
}

export type NavPage = { href: string; label: string; trail: string; icon?: React.ElementType }

/** Flatten a sidebar tree into pages, each with the path it sits under. */
export function flattenNavSections(sections: NavPageSection[]): NavPage[] {
  const pages: NavPage[] = []
  const seen = new Set<string>()
  const add = (page: NavPage) => {
    if (seen.has(page.href)) return
    seen.add(page.href)
    pages.push(page)
  }
  for (const section of sections) {
    for (const item of section.items) {
      add({ href: item.href, label: item.name, trail: section.label, icon: item.icon })
      for (const child of item.children ?? []) {
        add({ href: child.href, label: child.name, trail: item.name, icon: item.icon })
        for (const sub of child.children ?? []) {
          add({ href: sub.href, label: sub.name, trail: `${item.name} › ${child.name}`, icon: item.icon })
        }
      }
    }
  }
  return pages
}

// One shared index: the sidebar on screen publishes the pages it shows the
// viewer (already permission-filtered); the navbar search reads them.
let current: NavPage[] = []
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Sidebars call this with their filtered sections. */
export function usePublishNavPages(sections: NavPageSection[]) {
  useEffect(() => {
    const next = flattenNavSections(sections)
    // Sections are rebuilt on every sidebar render; only notify on a real change.
    const same =
      next.length === current.length &&
      next.every((page, i) => page.href === current[i].href && page.label === current[i].label)
    if (same) return
    current = next
    listeners.forEach((listener) => listener())
  }, [sections])
}

const EMPTY: NavPage[] = []

/** Pages the viewer can open, for search. */
export function useNavPages(): NavPage[] {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => EMPTY
  )
}

/** Case-insensitive match on the label first, then the trail. */
export function matchNavPages(pages: NavPage[], query: string, limit = 6): NavPage[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const starts = pages.filter((p) => p.label.toLowerCase().startsWith(q))
  const contains = pages.filter((p) => !p.label.toLowerCase().startsWith(q) && p.label.toLowerCase().includes(q))
  const inTrail = pages.filter((p) => !p.label.toLowerCase().includes(q) && p.trail.toLowerCase().includes(q))
  return [...starts, ...contains, ...inTrail].slice(0, limit)
}
