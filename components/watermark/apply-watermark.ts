import JSZip from "jszip"
import { toast } from "sonner"
import { logger } from "@/lib/logger"
import { processImage } from "@/lib/process-image"
import { processVideo } from "@/lib/process-video"
import type { WatermarkConfig } from "@/components/watermark-studio"

const log = logger("watermark-apply")

interface ApplyWatermarkParams {
  mediaType: "image" | "video" | null
  mediaFile: File | null
  mediaFiles: File[]
  selectedWatermark: string
  config: WatermarkConfig
  customFileName: string
  applyToAll: boolean
  onProcessedUrl: (url: string | null) => void
  onProcessingChange: (processing: boolean) => void
}

export async function applyWatermark({
  mediaType,
  mediaFile,
  mediaFiles,
  selectedWatermark,
  config,
  customFileName,
  applyToAll,
  onProcessedUrl,
  onProcessingChange,
}: ApplyWatermarkParams): Promise<void> {
  if ((mediaType === "image" && mediaFiles.length === 0) || (mediaType === "video" && !mediaFile) || !mediaType) {
    toast.error("No media selected", { description: "Please upload an image or video first." })
    return
  }

  onProcessingChange(true)

  try {
    if (mediaType === "image") {
      if (applyToAll && mediaFiles.length > 1) {
        const zip = new JSZip()
        const total = mediaFiles.length
        let successCount = 0
        const baseName = customFileName.trim() ? customFileName.trim().replace(/[^a-zA-Z0-9_-]/g, "_") : "watermarked"

        for (let i = 0; i < mediaFiles.length; i++) {
          const file = mediaFiles[i]
          try {
            const url = await processImage(file, selectedWatermark, config)
            const resp = await fetch(url)
            const blob = await resp.blob()
            const arrayBuffer = await blob.arrayBuffer()
            const originalExt = file.name.split(".").pop()?.toLowerCase() || "png"
            const outExt = blob.type.includes("png")
              ? "png"
              : blob.type.includes("jpeg")
                ? "jpg"
                : blob.type.includes("webp")
                  ? "webp"
                  : originalExt
            zip.file(`${baseName}_${i + 1}.${outExt}`, arrayBuffer)
            successCount += 1
            URL.revokeObjectURL(url)
          } catch (err) {
            log.warn({ err: String(err), file: file.name }, "failed to process image")
          }
        }

        if (successCount !== total) {
          toast.error("Processing failed", {
            description: `Uploaded ${total}, processed ${successCount}. Please retry or remove problematic images.`,
          })
          return
        }

        const zipBlob = await zip.generateAsync({ type: "blob" })
        const zipUrl = URL.createObjectURL(zipBlob)
        const link = document.createElement("a")
        link.href = zipUrl
        link.download = `${baseName}.zip`
        link.style.display = "none"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        setTimeout(() => URL.revokeObjectURL(zipUrl), 4000)
        toast.success("Success!", { description: `Uploaded ${total}, downloaded ${successCount}.` })
        onProcessedUrl(null)
      } else if (mediaFile) {
        const result = await processImage(mediaFile, selectedWatermark, config)
        onProcessedUrl(result)
        toast.success("Success!", { description: "Your watermark has been applied." })
      }
    } else if (mediaFile) {
      const result = await processVideo(mediaFile, selectedWatermark, config)
      onProcessedUrl(result)
      toast.success("Success!", { description: "Your watermark has been applied." })
    }
  } catch (error) {
    log.error({ err: String(error) }, "error processing media")
    toast.error("Processing failed", {
      description: error instanceof Error ? error.message : "An error occurred while processing.",
    })
  } finally {
    onProcessingChange(false)
  }
}
