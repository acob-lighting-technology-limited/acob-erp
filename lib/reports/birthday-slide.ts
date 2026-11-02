/**
 * Screenshots the /birthday spotlight for the agenda deck. The design is sized
 * in vw/vh, so it is rendered in a hidden 1920×1080 iframe (/birthday/slide) —
 * a viewport of exactly slide size — which posts the image back here.
 */

export const BIRTHDAY_SLIDE_MESSAGE = "acob:birthday-slide"

export type BirthdaySlidePayload = { captureId: string } & (
  | { dataUrl: string; width: number; height: number; count: number; error?: undefined }
  | { error: string }
)

export type BirthdaySlideMessage = { type: typeof BIRTHDAY_SLIDE_MESSAGE } & BirthdaySlidePayload

export interface BirthdaySlideCapture {
  dataUrl: string
  width: number
  height: number
  /** Celebrants on the slide. */
  count: number
}

const CAPTURE_TIMEOUT_MS = 45_000

/**
 * `start`/`end` are MM-DD and `label` is the range pill under the names; the
 * `up*` fields are the "Coming up" summary in the bottom-right corner.
 */
export function captureBirthdaySlide(params: {
  start: string
  end: string
  label: string
  upStart: string
  upEnd: string
  upLabel: string
}) {
  return new Promise<BirthdaySlideCapture>((resolve, reject) => {
    const captureId = crypto.randomUUID()
    const iframe = document.createElement("iframe")
    const query = new URLSearchParams({ ...params, id: captureId })
    iframe.src = `/birthday/slide?${query.toString()}`
    iframe.setAttribute("aria-hidden", "true")
    iframe.tabIndex = -1
    // In the viewport but invisible: browsers skip loading lazy images and may
    // stop rendering frames that are positioned off-screen.
    Object.assign(iframe.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "1920px",
      height: "1080px",
      // globals.css caps every element at max-width: 100%, which would shrink the
      // frame to the browser width and leave the slide's right side empty.
      maxWidth: "none",
      maxHeight: "none",
      border: "0",
      opacity: "0",
      pointerEvents: "none",
      zIndex: "-1",
    })

    const cleanup = () => {
      window.removeEventListener("message", onMessage)
      window.clearTimeout(timer)
      iframe.remove()
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframe.contentWindow) return
      const data = event.data as BirthdaySlideMessage | undefined
      if (data?.type !== BIRTHDAY_SLIDE_MESSAGE || data.captureId !== captureId) return
      cleanup()
      if (data.error !== undefined) reject(new Error(data.error))
      else resolve({ dataUrl: data.dataUrl, width: data.width, height: data.height, count: data.count })
    }

    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error("The birthday slide took too long to render"))
    }, CAPTURE_TIMEOUT_MS)

    window.addEventListener("message", onMessage)
    document.body.appendChild(iframe)
  })
}
