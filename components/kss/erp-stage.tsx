"use client"

import { useEffect, useRef, useState } from "react"
import type { ErpSceneConfig } from "@/types/presentation"

export function ErpStage({
  config,
  isActive,
  onNavigateRequest,
}: {
  config: ErpSceneConfig
  isActive: boolean
  onNavigateRequest?: (direction: "previous" | "next") => void
}) {
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [showFallback, setShowFallback] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!isActive) {
      setShowFallback(false)
      setIframeLoaded(false)
    }
  }, [isActive])

  useEffect(() => {
    if (iframeLoaded) {
      return
    }

    const timeout = window.setTimeout(() => {
      setShowFallback(true)
    }, 4500)

    return () => window.clearTimeout(timeout)
  }, [iframeLoaded])

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [])

  const openFallback = () => {
    window.open(config.url, "_blank", "noopener,noreferrer")
  }

  const bindIframeNavigation = () => {
    cleanupRef.current?.()
    cleanupRef.current = null

    const iframe = iframeRef.current

    if (!iframe || !onNavigateRequest) {
      return
    }

    try {
      const iframeWindow = iframe.contentWindow
      const iframeDocument = iframeWindow?.document

      if (!iframeWindow || !iframeDocument) {
        return
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "ArrowRight") {
          event.preventDefault()
          onNavigateRequest("next")
        }

        if (event.key === "ArrowLeft") {
          event.preventDefault()
          onNavigateRequest("previous")
        }
      }

      iframeWindow.addEventListener("keydown", handleKeyDown, true)
      iframeDocument.addEventListener("keydown", handleKeyDown, true)

      cleanupRef.current = () => {
        iframeWindow.removeEventListener("keydown", handleKeyDown, true)
        iframeDocument.removeEventListener("keydown", handleKeyDown, true)
      }
    } catch {
      cleanupRef.current = null
    }
  }

  const handleLoad = () => {
    setIframeLoaded(true)
    bindIframeNavigation()
  }

  return (
    <div className="erp-stage">
      <div className="erp-stage__viewport">
        <iframe
          ref={iframeRef}
          src={config.url}
          title={`Live ACOB ERP ${config.displayUrl}`}
          onLoad={handleLoad}
          allow="clipboard-read; clipboard-write"
        />

        {!iframeLoaded ? (
          <div className="erp-stage__loading">
            <div className="erp-stage__loader" aria-hidden="true">
              <span />
            </div>
            <span className="sr-only">{config.loadingTitle}</span>
          </div>
        ) : null}

        {showFallback && !iframeLoaded ? (
          <div className="erp-stage__fallback">
            <h2>{config.blockedTitle}</h2>
            <p>{config.blockedBody}</p>
            <button className="erp-stage__fallback-button" onClick={openFallback} type="button">
              Open ERP directly
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
