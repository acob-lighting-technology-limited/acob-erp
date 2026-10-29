"use client"

import { useSidebar } from "./sidebar-context"
import { motion } from "framer-motion"
import { useIsMobile } from "@/hooks/use-mobile"
import { useShellTransition } from "@/hooks/use-shell-transition"

export function SidebarContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar()
  const isMobile = useIsMobile(1024)
  const transition = useShellTransition()

  return (
    <motion.main
      initial={false}
      animate={{
        paddingLeft: isMobile ? 0 : isCollapsed ? 80 : 256,
      }}
      transition={transition}
      id="main-content"
      tabIndex={-1}
      className="flex-1 pt-16 outline-none max-lg:pl-0"
    >
      {children}
    </motion.main>
  )
}
