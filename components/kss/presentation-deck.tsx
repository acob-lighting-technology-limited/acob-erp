"use client"

import Image from "next/image"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import { ErpStage } from "@/components/kss/erp-stage"
import { erpSceneConfig, presentationScenes } from "@/lib/kss/presentation-content"
import type { ErpSceneConfig, SceneConfig } from "@/types/presentation"

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1]

const backgroundVariants = {
  initial: { opacity: 0.96 },
  animate: { opacity: 1, transition: { duration: 0.4, ease } },
  exit: { opacity: 0.96, transition: { duration: 0.28, ease } },
}

const contentVariants = {
  initial: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? 54 : -54,
    filter: "blur(8px)",
  }),
  animate: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? -40 : 40,
    filter: "blur(8px)",
    transition: { duration: 0.35, ease },
  }),
}

const cardContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.22,
    },
  },
}

const cardItemVariants = {
  hidden: {
    opacity: 0,
    y: 42,
    scale: 0.94,
    rotateX: -10,
    filter: "blur(12px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.7,
      ease,
    },
  },
}

function AnimatedGrid({
  sceneKey,
  children,
  className,
}: {
  sceneKey: string
  children: React.ReactNode
  className?: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      key={sceneKey}
      className={className}
      variants={reduceMotion ? undefined : cardContainerVariants}
      initial={reduceMotion ? { opacity: 0, y: 12 } : "hidden"}
      animate={reduceMotion ? { opacity: 1, y: 0 } : "visible"}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: reduceMotion ? 0.2 : 0.45, ease }}
    >
      {children}
    </motion.div>
  )
}

function SlideCard({ title, body, label, value }: { title?: string; body: string; label?: string; value?: string }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div className="slide-card" variants={reduceMotion ? undefined : cardItemVariants}>
      {label ? <div className="slide-card__label">{label}</div> : null}
      {value ? <div className="slide-card__value">{value}</div> : null}
      {title ? <h3>{title}</h3> : null}
      <p>{body}</p>
    </motion.div>
  )
}

function SlideBody({ scene }: { scene: SceneConfig }) {
  if (scene.layout === "erp") {
    const sceneConfig: ErpSceneConfig = scene.erpPath
      ? {
          ...erpSceneConfig,
          url: scene.erpPath,
          displayUrl: scene.erpPath === "/" ? "erp.acoblighting.com/" : `erp.acoblighting.com${scene.erpPath}`,
        }
      : erpSceneConfig

    return (
      <ErpStage
        config={sceneConfig}
        isActive
        onNavigateRequest={(direction) => {
          window.dispatchEvent(new CustomEvent("erp-kss:navigate", { detail: direction }))
        }}
      />
    )
  }

  if (scene.layout === "closing") {
    return (
      <div className="slide slide--closing">
        <h2 className="slide__title">{scene.title}</h2>
        <p className="slide__body">{scene.body}</p>
        <AnimatedGrid sceneKey={`${scene.id}-closing`} className="slide__grid">
          {scene.bullets?.map((item) => (
            <SlideCard key={item.title} title={item.title} body={item.body} />
          ))}
        </AnimatedGrid>
      </div>
    )
  }

  return (
    <div className="slide">
      {scene.layout === "hero" ? (
        <h1 className="slide__title slide__title--hero">{scene.title}</h1>
      ) : (
        <h2 className="slide__title">{scene.title}</h2>
      )}
      <p className="slide__body">{scene.body}</p>

      {scene.metrics ? (
        <AnimatedGrid sceneKey={`${scene.id}-metrics`} className="slide__grid slide__grid--metrics">
          {scene.metrics.map((metric) => (
            <SlideCard key={metric.label} label={metric.label} value={metric.value} body={metric.description} />
          ))}
        </AnimatedGrid>
      ) : null}

      {scene.cards ? (
        <AnimatedGrid sceneKey={`${scene.id}-cards`} className="slide__grid">
          {scene.cards.map((card) => (
            <SlideCard key={card.title} title={card.title} body={card.body} />
          ))}
        </AnimatedGrid>
      ) : null}

      {scene.bullets ? (
        <AnimatedGrid sceneKey={`${scene.id}-bullets`} className="slide__grid">
          {scene.bullets.map((bullet) => (
            <SlideCard key={bullet.title} title={bullet.title} body={bullet.body} />
          ))}
        </AnimatedGrid>
      ) : null}
    </div>
  )
}

export function PresentationDeck() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const reduceMotion = useReducedMotion()
  const previousIndexRef = useRef(0)
  const activeScene = useMemo(() => presentationScenes[activeIndex], [activeIndex])

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      container.scrollBy({
        left: event.deltaY + event.deltaX,
        behavior: reduceMotion ? "auto" : "smooth",
      })
    }

    const handleScroll = () => {
      const width = window.innerWidth || 1
      const index = Math.round(container.scrollLeft / width)
      const nextIndex = Math.max(0, Math.min(index, presentationScenes.length - 1))

      if (nextIndex !== previousIndexRef.current) {
        setDirection(nextIndex > previousIndexRef.current ? 1 : -1)
        previousIndexRef.current = nextIndex
      }

      setActiveIndex(nextIndex)
    }

    window.addEventListener("wheel", handleWheel, { passive: false })
    container.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener("wheel", handleWheel)
      container.removeEventListener("scroll", handleScroll)
    }
  }, [reduceMotion])

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const goToScene = (nextIndex: number) => {
      setDirection(nextIndex > activeIndex ? 1 : -1)
      container.scrollTo({
        left: window.innerWidth * nextIndex,
        behavior: reduceMotion ? "auto" : "smooth",
      })
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault()
        goToScene(Math.min(activeIndex + 1, presentationScenes.length - 1))
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault()
        goToScene(Math.max(activeIndex - 1, 0))
      }
    }

    const handleIframeNavigation = (event: Event) => {
      const directionDetail = (event as CustomEvent<"previous" | "next">).detail

      if (directionDetail === "next") {
        goToScene(Math.min(activeIndex + 1, presentationScenes.length - 1))
      }

      if (directionDetail === "previous") {
        goToScene(Math.max(activeIndex - 1, 0))
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("erp-kss:navigate", handleIframeNavigation as EventListener)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("erp-kss:navigate", handleIframeNavigation as EventListener)
    }
  }, [activeIndex, reduceMotion])

  return (
    <main className="presentation-shell">
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={activeScene.theme}
          className={`presentation-shell__fixed-bg presentation-shell__fixed-bg--${activeScene.theme}`}
          variants={backgroundVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          aria-hidden="true"
        />
      </AnimatePresence>

      {activeScene.layout !== "erp" ? (
        <>
          <div className="deck-fixed-topbar">
            <div className="deck-fixed-topbar__topic">{activeScene.eyebrow}</div>
            <div className="deck-fixed-topbar__logo">
              <Image
                className="deck-fixed-topbar__logo-dark"
                src="/images/acob-logo-dark.png"
                alt="ACOB ERP logo"
                width={152}
                height={48}
                priority
              />
              <Image
                className="deck-fixed-topbar__logo-light"
                src="/images/acob-logo-light.png"
                alt="ACOB ERP logo"
                width={152}
                height={48}
                priority
              />
            </div>
          </div>

          <div className="deck-fixed-watermark" aria-hidden="true">
            <Image src="/images/acob-logo-watermark.png" alt="" width={420} height={420} />
          </div>

          <div className="deck-progress-top" aria-hidden="true">
            <span style={{ width: `${((activeIndex + 1) / presentationScenes.length) * 100}%` }} />
          </div>

          <div className="deck-page-count" aria-hidden="true">
            {String(activeIndex + 1).padStart(2, "0")}/{String(presentationScenes.length).padStart(2, "0")}
          </div>
        </>
      ) : null}

      <div className="deck-scroll" ref={containerRef}>
        {presentationScenes.map((scene) => (
          <section key={scene.id} className="scene" aria-label={scene.title} />
        ))}
      </div>

      <div className="deck-body-layer">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeScene.id}
            className={`deck-body-layer__content${activeScene.layout === "erp" ? "deck-body-layer__content--erp" : ""}`}
            custom={direction}
            variants={contentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <SlideBody scene={activeScene} />
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  )
}
