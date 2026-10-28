"use client"

import { useSidebar } from "./sidebar-context"
import { motion } from "framer-motion"
import { useIsMobile } from "@/hooks/use-mobile"

export function SidebarContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar()
  const isMobile = useIsMobile(1024)

  return (
    <motion.main
      initial={false}
      animate={{
        paddingLeft: isMobile ? 0 : isCollapsed ? 80 : 256,
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
      }}
      id="main-content"
      tabIndex={-1}
      className="flex-1 pt-16 outline-none max-lg:pl-0"
    >
      {children}
    </motion.main>
  )
}
