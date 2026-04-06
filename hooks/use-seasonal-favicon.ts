import { useEffect } from "react"
import { isChristmasPeriod } from "@/lib/seasonal-branding"

export function useSeasonalFavicon() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const updateFavicon = (isDark: boolean) => {
      const faviconPath = isChristmasPeriod()
        ? isDark
          ? "/favicon-dark-christmas.ico"
          : "/favicon-light-christmas.ico"
        : "/favicon.ico"

      let faviconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement | null

      if (!faviconLink) {
        faviconLink = document.createElement("link")
        faviconLink.rel = "icon"
        faviconLink.type = "image/x-icon"
        document.head.appendChild(faviconLink)
      }

      if (faviconLink.href !== `${window.location.origin}${faviconPath}`) {
        faviconLink.href = faviconPath
      }
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    updateFavicon(mediaQuery.matches)

    const handleChange = () => updateFavicon(mediaQuery.matches)

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange)
    } else {
      mediaQuery.addListener(handleChange)
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange)
      } else {
        mediaQuery.removeListener(handleChange)
      }
    }
  }, [])
}
