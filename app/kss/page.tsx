"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useMemo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"

type Track = "it" | "communications"
type Stage = "single" | "split" | "ring" | "detail"

interface Capability {
  id: string
  label: string
  details: string[]
  presentationPath?: string
}

const IT_CAPABILITIES: Capability[] = [
  {
    id: "software-development",
    label: "Software Development",
    details: [
      "Application development (web, mobile, internal tools)",
      "API development and integrations",
      "ERP system development/customization",
      "Automation scripts and tools",
    ],
    presentationPath: "/kss/it/software-development/erp",
  },
  {
    id: "infrastructure-systems",
    label: "Infrastructure and Systems",
    details: [
      "Network setup and management (LAN/WAN, routers, firewalls)",
      "Server and system administration",
      "Device management (PCs, printers, TVs, IoT)",
      "Cloud infrastructure (Microsoft 365, Azure, etc.)",
    ],
  },
  {
    id: "cybersecurity",
    label: "Cybersecurity",
    details: [
      "Identity and access management (users, roles, permissions)",
      "MFA and security policy enforcement",
      "Threat monitoring and basic incident response",
      "Endpoint and network security",
    ],
    presentationPath: "/kss/it/cybersecurity",
  },
  {
    id: "data-ai-automation",
    label: "Data, AI and Automation",
    details: [
      "Data management and storage",
      "Reporting and analytics",
      "Process automation (scripts, workflows)",
      "AI tools integration (where applicable)",
    ],
  },
  {
    id: "it-support-operations",
    label: "IT Support and Operations",
    details: [
      "Helpdesk and user support",
      "Hardware/software troubleshooting",
      "System maintenance and updates",
      "IT asset management",
    ],
  },
  {
    id: "monitoring-control",
    label: "Monitoring and Control",
    details: [
      "Network and system monitoring",
      "Access and usage control (internet, devices)",
      "Logs and activity tracking",
      "Performance monitoring",
    ],
  },
]

const COMMUNICATIONS_CAPABILITIES: Capability[] = [
  {
    id: "corporate-digital-comms",
    label: "Corporate and Digital Communications",
    details: [
      "Internal communications (announcements, memos)",
      "Official company messaging",
      "Email communications and templates",
      "Stakeholder communication support",
    ],
  },
  {
    id: "digital-social-media",
    label: "Digital and Social Media",
    details: [
      "Social media management",
      "Campaign planning and execution",
      "Online engagement and community management",
      "Performance tracking (analytics)",
    ],
  },
  {
    id: "content-media",
    label: "Content and Media",
    details: [
      "Content writing (web, social, internal)",
      "Copywriting and storytelling",
      "Photography/video coordination",
      "Documentation and publications",
    ],
  },
  {
    id: "design-branding",
    label: "Design and Branding",
    details: [
      "Graphic design (posts, banners, materials)",
      "Brand identity management",
      "Visual consistency across platforms",
      "Media asset management",
    ],
  },
]

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1]
const stageTransition = { duration: 0.42, ease }
const LEAF_SIZE_PX = 168

function getRadialPosition(index: number, total: number, radius: number, startAngleDeg = -90) {
  const angle = ((startAngleDeg + (360 / total) * index) * Math.PI) / 180
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  }
}

export default function KssHubPage() {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [stage, setStage] = useState<Stage>("single")
  const [track, setTrack] = useState<Track | null>(null)
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<string | null>(null)
  const [isExiting, setIsExiting] = useState(false)

  const navigateTo = useCallback(
    (path: string) => {
      if (reduceMotion) {
        router.push(path)
        return
      }
      setIsExiting(true)
      setTimeout(() => {
        router.push(path)
      }, 600)
    },
    [router, reduceMotion]
  )

  const capabilities = useMemo(() => {
    if (track === "it") return IT_CAPABILITIES
    if (track === "communications") return COMMUNICATIONS_CAPABILITIES
    return []
  }, [track])

  const selectedCapability = useMemo(
    () => capabilities.find((item) => item.id === selectedCapabilityId) || null,
    [capabilities, selectedCapabilityId]
  )

  const radius = track === "it" ? 240 : 220

  const handleBack = () => {
    if (stage === "detail") {
      setSelectedCapabilityId(null)
      setStage("ring")
      return
    }
    if (stage === "ring") {
      setTrack(null)
      setSelectedCapabilityId(null)
      setStage("split")
      return
    }
    if (stage === "split") {
      setStage("single")
    }
  }

  return (
    <motion.main
      className="cyber-hub"
      animate={
        isExiting ? { opacity: 0, scale: 0.96, filter: "blur(12px)" } : { opacity: 1, scale: 1, filter: "blur(0px)" }
      }
      transition={{ duration: 0.5, ease }}
    >
      <div className="cyber-hub__backdrop" aria-hidden="true" />
      <div className="cyber-hub__orbit" aria-hidden="true" />

      <section className="cyber-hub__stage">
        <AnimatePresence mode="wait" initial={false}>
          {stage === "single" ? (
            <motion.div
              key="single"
              className="cyber-scene"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={stageTransition}
            >
              <motion.button
                className="cyber-node cyber-node--main"
                type="button"
                onClick={() => setStage("split")}
                initial={{ scale: 0.75, opacity: 0, filter: "blur(12px)" }}
                animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.7, ease }}
                whileHover={reduceMotion ? undefined : { scale: 1.045 }}
                whileTap={{ scale: 0.97 }}
              >
                IT and Communications
              </motion.button>
            </motion.div>
          ) : null}

          {stage === "split" ? (
            <motion.div
              key="split"
              className="cyber-scene cyber-scene--split"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={stageTransition}
            >
              {(["it", "communications"] as const).map((trackId, i) => (
                <motion.button
                  key={trackId}
                  className="cyber-node cyber-node--branch"
                  type="button"
                  initial={{ x: 0, scale: 0.7, opacity: 0, filter: "blur(10px)" }}
                  animate={{ x: trackId === "it" ? -110 : 110, scale: 1, opacity: 1, filter: "blur(0px)" }}
                  exit={{ x: 0, scale: 0.65, opacity: 0, filter: "blur(10px)" }}
                  transition={{ ...stageTransition, delay: i * 0.08 }}
                  whileHover={reduceMotion ? undefined : { scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setTrack(trackId)
                    setSelectedCapabilityId(null)
                    setStage("ring")
                  }}
                >
                  {trackId === "it" ? "IT" : "Communications"}
                </motion.button>
              ))}
            </motion.div>
          ) : null}

          {stage === "ring" && track ? (
            <motion.div
              key={`ring-${track}`}
              className="cyber-scene"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={stageTransition}
            >
              <motion.button
                className="cyber-node cyber-node--center"
                type="button"
                disabled
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease }}
                layout
              >
                {track === "it" ? "IT" : "Communications"}
              </motion.button>

              <div className="cyber-ring" role="group" aria-label="Capability areas">
                <AnimatePresence>
                  {capabilities.map((capability, index) => {
                    const position = getRadialPosition(index, capabilities.length, radius)
                    return (
                      <motion.button
                        key={capability.id}
                        className="cyber-node cyber-node--leaf"
                        type="button"
                        style={{
                          left: `calc(50% - ${LEAF_SIZE_PX / 2}px)`,
                          top: `calc(50% - ${LEAF_SIZE_PX / 2}px)`,
                        }}
                        initial={{ x: 0, y: 0, scale: 0.3, opacity: 0, filter: "blur(14px)" }}
                        animate={{ x: position.x, y: position.y, scale: 1, opacity: 1, filter: "blur(0px)" }}
                        exit={{ x: 0, y: 0, scale: 0.3, opacity: 0, filter: "blur(12px)" }}
                        transition={{ ...stageTransition, delay: index * 0.055 }}
                        whileHover={reduceMotion ? undefined : { scale: 1.08 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          setSelectedCapabilityId(capability.id)
                          setStage("detail")
                        }}
                      >
                        {capability.label}
                      </motion.button>
                    )
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : null}

          {stage === "detail" && selectedCapability && track ? (
            <motion.article
              key={`detail-${selectedCapability.id}`}
              className="cyber-scene cyber-scene--detail"
              initial={{ opacity: 0, scale: 0.82, filter: "blur(18px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.88, filter: "blur(12px)" }}
              transition={{ duration: 0.5, ease }}
            >
              <motion.button
                className={`cyber-node cyber-node--detail${selectedCapability.presentationPath ? "cyber-node--detail-clickable" : ""}`}
                type="button"
                layout
                whileHover={selectedCapability.presentationPath && !reduceMotion ? { scale: 1.02 } : undefined}
                whileTap={selectedCapability.presentationPath ? { scale: 0.98 } : undefined}
                onClick={() => {
                  if (selectedCapability.presentationPath) {
                    navigateTo(selectedCapability.presentationPath)
                  }
                }}
              >
                <div className="cyber-node__detail-content">
                  <span className="cyber-node__detail-title">{selectedCapability.label}</span>
                  <ol className="cyber-node__detail-list">
                    {selectedCapability.details.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                </div>
              </motion.button>
            </motion.article>
          ) : null}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {stage !== "single" ? (
          <motion.button
            className="cyber-back-arrow"
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            initial={{ opacity: 0, y: 12, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.85 }}
            transition={{ duration: 0.28, ease }}
          >
            ←
          </motion.button>
        ) : null}
      </AnimatePresence>
    </motion.main>
  )
}
