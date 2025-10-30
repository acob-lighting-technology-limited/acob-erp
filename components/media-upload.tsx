"use client"

import type React from "react"

import { useCallback } from "react"
import { Upload } from "lucide-react"
import { toast } from "sonner"
import { motion } from "framer-motion"

interface MediaUploadProps {
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

export function MediaUpload({ onUpload }: MediaUploadProps) {
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

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="relative border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-muted-foreground transition-colors cursor-pointer glass-effect"
      onClick={() => document.getElementById("media-upload")?.click()}
    >
      <input id="media-upload" type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleChange} />
      <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
      <p className="text-sm text-foreground font-medium mb-1">Drag & drop or click to upload</p>
      <p className="text-xs text-muted-foreground">Supports JPG, PNG, MP4, MOV</p>
    </motion.div>
  )
}
