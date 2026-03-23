"use client"

import { motion } from "framer-motion"
import "../../kss.css"
import "../../cyber-kss.css"

export default function CybersecurityKssPresentationLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <motion.div
      className="erp-kss-route cyber-kss-route"
      initial={{ opacity: 0, scale: 1.04, filter: "blur(12px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
