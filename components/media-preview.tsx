"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Upload } from "lucide-react"
import { toast } from "sonner"
import type { WatermarkConfig } from "@/components/watermark-studio"

interface MediaPreviewProps {
  mediaFile: File | null
  mediaType: "image" | "video" | null
  watermarkPath: string
  config: WatermarkConfig
  processedUrl: string | null
  onUpload: (files: File[], type: "image" | "video") => void
}

const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"]

function isImageFile(file: File): boolean {
  if (file.type && file.type.startsWith("image/")) return true
  const name = file.name || ""
  return /(\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?|svg))$/i.test(name)
}

function isVideoFile(file: File): boolean {
  if (file.type && ACCEPTED_VIDEO_TYPES.includes(file.type)) return true
  const name = file.name || ""
  return /(\.(mp4|mov|webm))$/i.test(name)
}

export function MediaPreview({ mediaFile, mediaType, watermarkPath, config, processedUrl, onUpload }: MediaPreviewProps) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (mediaFile) {
      const url = URL.createObjectURL(mediaFile)
      setMediaUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [mediaFile])

  useEffect(() => {
    if (!mediaUrl || !canvasRef.current || mediaType !== "image" || processedUrl) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.src = mediaUrl

    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const watermark = new window.Image()
      watermark.crossOrigin = "anonymous"
      watermark.src = watermarkPath

      watermark.onload = () => {
        const watermarkWidth = (img.width * config.size) / 100
        const watermarkHeight = (watermark.height * watermarkWidth) / watermark.width

        const positions = {
          "top-left": { x: 20, y: 20 },
          "top-center": { x: (img.width - watermarkWidth) / 2, y: 20 },
          "top-right": { x: img.width - watermarkWidth - 20, y: 20 },
          "middle-left": { x: 20, y: (img.height - watermarkHeight) / 2 },
          center: {
            x: (img.width - watermarkWidth) / 2,
            y: (img.height - watermarkHeight) / 2,
          },
          "middle-right": {
            x: img.width - watermarkWidth - 20,
            y: (img.height - watermarkHeight) / 2,
          },
          "bottom-left": { x: 20, y: img.height - watermarkHeight - 20 },
          "bottom-center": {
            x: (img.width - watermarkWidth) / 2,
            y: img.height - watermarkHeight - 20,
          },
          "bottom-right": {
            x: img.width - watermarkWidth - 20,
            y: img.height - watermarkHeight - 20,
          },
        }

        const pos = positions[config.position]
        ctx.globalAlpha = config.opacity
        ctx.drawImage(watermark, pos.x, pos.y, watermarkWidth, watermarkHeight)
        ctx.globalAlpha = 1
      }
    }
  }, [mediaUrl, watermarkPath, config, mediaType, processedUrl])

  const handleFiles = useCallback(
    (list: FileList | File[]) => {
      const files = Array.from(list)
      const images = files.filter((f) => isImageFile(f))
      const videos = files.filter((f) => isVideoFile(f))

      if (videos.length > 1 || (videos.length === 1 && images.length > 0)) {
        toast.error("Invalid selection", {
          description: "Upload either one video or one/more images.",
        })
        return
      }

      if (videos.length === 1) {
        onUpload([videos[0]], "video")
        return
      }

      if (images.length > 0) {
        const MAX = 50
        const selected = images.slice(0, MAX)
        if (images.length > MAX) {
          toast.message("Selection limited", {
            description: `Only the first ${MAX} images will be attached (of ${images.length}).`,
          })
        }
        onUpload(selected, "image")
        toast.success("Images attached", {
          description: `${selected.length} image${selected.length === 1 ? "" : "s"} ready to preview/process.`,
        })
        return
      }

      toast.error("Invalid file type", {
        description: "Please upload images or a single MP4/MOV/WEBM video.",
      })
    },
    [onUpload],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const { files } = e.dataTransfer
      if (files && files.length) handleFiles(files)
    },
    [handleFiles],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length) handleFiles(files)
    },
    [handleFiles],
  )

  if (!mediaFile) {
    return (
      <div className="h-full flex items-center justify-center">
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="relative border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-muted-foreground transition-colors cursor-pointer max-w-2xl w-full"
          onClick={() => document.getElementById("preview-media-upload")?.click()}
        >
          <input
            id="preview-media-upload"
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={handleChange}
          />
          <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground mb-2">No media uploaded</h2>
          <p className="text-sm text-muted-foreground">
            Drag & drop or click to upload an image or video to get started
          </p>
          <p className="text-xs text-muted-foreground mt-2">Supports JPG, PNG, MP4, MOV</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-6">
      <AnimatePresence mode="wait">
        {processedUrl ? (
          <motion.div
            key="processed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-4xl w-full"
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground">Processed Result</h3>
              <p className="text-sm text-muted-foreground">Your watermarked media is ready</p>
            </div>
            <div className="rounded-lg overflow-hidden border border-border glass-effect">
              {mediaType === "image" ? (
                <img src={processedUrl || "/placeholder.svg"} alt="Processed" className="w-full h-auto" />
              ) : (
                <video src={processedUrl} controls className="w-full h-auto" />
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-4xl w-full"
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground">Live Preview</h3>
              <p className="text-sm text-muted-foreground">Adjust settings to see changes in real-time</p>
            </div>
            <div className="rounded-lg overflow-hidden border border-border glass-effect">
              {mediaType === "image" ? (
                <canvas ref={canvasRef} className="w-full h-auto" />
              ) : (
                <video ref={videoRef} src={mediaUrl || ""} controls className="w-full h-auto" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
