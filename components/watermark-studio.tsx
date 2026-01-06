"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import JSZip from "jszip"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { MediaPreview } from "@/components/media-preview"
import { PositionGrid } from "@/components/position-grid"
import { ImageGallery } from "@/components/image-gallery"
import { processImage } from "@/lib/process-image"
import { processVideo } from "@/lib/process-video"

export type Position =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "center-down-10"
  | "center-down-20"
  | "center-down-25"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"

export interface WatermarkConfig {
  position: Position
  opacity: number
  size: number
}

export interface WatermarkPreset {
  id: string
  name: string
  description: string
  config: WatermarkConfig
}

// Watermark Presets - Pre-configured settings for different use cases
const WATERMARK_PRESETS: WatermarkPreset[] = [
  {
    id: "custom",
    name: "Custom",
    description: "Manually configure all settings",
    config: {
      position: "middle-right",
      opacity: 0.44,
      size: 25,
    },
  },
  {
    id: "website-optimized",
    name: "Website Optimized",
    description: "Perfect for website images - balanced protection & aesthetics",
    config: {
      position: "center-down-20",
      opacity: 0.3,
      size: 18,
    },
  },
  {
    id: "subtle",
    name: "Subtle Corner",
    description: "Minimal watermark in bottom-right corner",
    config: {
      position: "bottom-right",
      opacity: 0.3,
      size: 15,
    },
  },
  {
    id: "prominent",
    name: "Prominent Center",
    description: "Bold watermark for maximum protection",
    config: {
      position: "center",
      opacity: 0.5,
      size: 30,
    },
  },
]

// Default watermark images - Change these paths to use different default watermarks
const DEFAULT_WATERMARKS = [
  { id: "default", name: "ACOB Logo (Light)", path: "/acob-logo-watermark.webp" },
  { id: "dark", name: "ACOB Logo (Dark)", path: "/acob-logo-watermark-dark.webp" },
]

export function WatermarkStudio() {
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0) // currently selected image for preview
  const [mediaFile, setMediaFile] = useState<File | null>(null) // current preview
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null)
  const [watermarks, setWatermarks] = useState(DEFAULT_WATERMARKS)
  const [selectedWatermark, setSelectedWatermark] = useState(DEFAULT_WATERMARKS[0].path)
  const [selectedPreset, setSelectedPreset] = useState<string>("custom")
  const [customFileName, setCustomFileName] = useState<string>("")

  // Watermark configuration - Adjust these defaults as needed
  const [config, setConfig] = useState<WatermarkConfig>({
    position: "middle-right", // Default position
    opacity: 0.44, // Default opacity (0-1)
    size: 25, // Default size as percentage of image width
  })

  const [isProcessing, setIsProcessing] = useState(false)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)

  const handleMediaUpload = useCallback((files: File[], type: "image" | "video") => {
    // For images we support multiple; for video, only the first is used
    if (type === "image") {
      setMediaFiles(files)
      setMediaFile(files[0] ?? null)
      setMediaType("image")
      setSelectedImageIndex(0)
    } else {
      const first = files[0] ?? null
      setMediaFiles(first ? [first] : [])
      setMediaFile(first)
      setMediaType(first ? "video" : null)
    }
    setProcessedUrl(null)
  }, [])

  const handleImageSelect = useCallback(
    (index: number) => {
      if (index >= 0 && index < mediaFiles.length) {
        setSelectedImageIndex(index)
        setMediaFile(mediaFiles[index])
        setProcessedUrl(null)
      }
    },
    [mediaFiles]
  )

  const handleRemoveImage = useCallback(
    (index: number) => {
      const newFiles = mediaFiles.filter((_, i) => i !== index)
      setMediaFiles(newFiles)

      if (newFiles.length === 0) {
        setMediaFile(null)
        setMediaType(null)
        setSelectedImageIndex(0)
        setProcessedUrl(null)
      } else {
        // Adjust selected index if necessary
        const newIndex = index >= newFiles.length ? newFiles.length - 1 : index
        setSelectedImageIndex(newIndex)
        setMediaFile(newFiles[newIndex])
        setProcessedUrl(null)
      }

      toast.success("Image removed", {
        description: `${newFiles.length} image${newFiles.length === 1 ? "" : "s"} remaining`,
      })
    },
    [mediaFiles]
  )

  const handleClearAllImages = useCallback(() => {
    setMediaFiles([])
    setMediaFile(null)
    setMediaType(null)
    setSelectedImageIndex(0)
    setProcessedUrl(null)

    toast.success("All images cleared", {
      description: "Upload new images to get started",
    })
  }, [])

  const handleWatermarkUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file", {
        description: "Please upload an image file for the watermark.",
      })
      return
    }

    const url = URL.createObjectURL(file)
    const newWatermark = {
      id: `custom-${Date.now()}`,
      name: file.name,
      path: url,
    }

    setWatermarks((prev) => [...prev, newWatermark])
    setSelectedWatermark(url)

    toast.success("Watermark added", {
      description: "Your custom watermark has been added to the list.",
    })
  }, [])

  const handlePresetChange = useCallback((presetId: string) => {
    setSelectedPreset(presetId)
    const preset = WATERMARK_PRESETS.find((p) => p.id === presetId)
    if (preset) {
      setConfig(preset.config)
      toast.success("Preset applied", {
        description: preset.description,
      })
    }
  }, [])

  const handleApplyWatermark = async (applyToAll = false) => {
    if ((mediaType === "image" && mediaFiles.length === 0) || (mediaType === "video" && !mediaFile) || !mediaType) {
      toast.error("No media selected", {
        description: "Please upload an image or video first.",
      })
      return
    }

    setIsProcessing(true)

    try {
      if (mediaType === "image") {
        if (applyToAll && mediaFiles.length > 1) {
          // Batch process all images into a single ZIP
          const zip = new JSZip()
          const total = mediaFiles.length
          let successCount = 0

          // Sanitize custom file name if provided
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
              // Use custom name with sequential numbering: Name_1, Name_2, etc.
              const fileName = `${baseName}_${i + 1}.${outExt}`
              zip.file(fileName, arrayBuffer)
              successCount += 1
              URL.revokeObjectURL(url)
            } catch (err) {
              console.warn("Failed to process", file.name, err)
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
          toast.success("Success!", {
            description: `Uploaded ${total}, downloaded ${successCount}.`,
          })
          setProcessedUrl(null)
        } else if (mediaFile) {
          // Process single selected image
          const result = await processImage(mediaFile, selectedWatermark, config)
          setProcessedUrl(result)
          toast.success("Success!", {
            description: "Your watermark has been applied.",
          })
        }
      } else if (mediaFile) {
        const result = await processVideo(mediaFile, selectedWatermark, config)
        setProcessedUrl(result)
        toast.success("Success!", {
          description: "Your watermark has been applied.",
        })
      }
    } catch (error) {
      console.error("[v0] Error processing media:", error)
      toast.error("Processing failed", {
        description: error instanceof Error ? error.message : "An error occurred while processing.",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!processedUrl) return

    const link = document.createElement("a")
    link.href = processedUrl
    link.download = `watermarked-${mediaFile?.name || "media"}`
    link.click()
  }

  return (
    <div className="flex h-screen flex-col lg:flex-row-reverse">
      {/* Left Sidebar - Controls */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="border-border bg-card w-full overflow-y-auto border-b p-6 lg:w-96 lg:border-r"
      >
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-foreground text-2xl font-bold">ACOB Watermark Studio</h1>
            <p className="text-muted-foreground mt-1 text-sm">Add watermarks to images and videos</p>
          </div>

          {/* Media Upload */}
          {/* <div className="space-y-2">
            <Label>Upload Media</Label>
            <MediaUpload onUpload={handleMediaUpload} />
            {mediaType === "image" && mediaFiles.length > 1 ? (
              <p className="text-xs text-muted-foreground">{mediaFiles.length} images attached. Previewing first.</p>
            ) : null}
          </div> */}

          {/* Preset Selection */}
          <div className="space-y-2">
            <Label>Watermark Preset</Label>
            <Select value={selectedPreset} onValueChange={handlePresetChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WATERMARK_PRESETS.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{preset.name}</span>
                      <span className="text-muted-foreground text-xs">{preset.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Watermark Selection */}
          <div className="space-y-2">
            <Label>Watermark Image</Label>
            <div className="flex gap-2">
              <Select value={selectedWatermark} onValueChange={setSelectedWatermark}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {watermarks.map((wm) => (
                    <SelectItem key={wm.id} value={wm.path}>
                      {wm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="icon"
                variant="outline"
                onClick={() => document.getElementById("watermark-upload")?.click()}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <input
                id="watermark-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleWatermarkUpload}
              />
            </div>
          </div>

          {/* Custom File Name */}
          {mediaType === "image" && mediaFiles.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="custom-file-name">Custom File Name (Optional)</Label>
              <Input
                id="custom-file-name"
                type="text"
                placeholder="e.g., Home (will create Home_1, Home_2, ...)"
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                className="w-full"
              />
              <p className="text-muted-foreground text-xs">
                {customFileName.trim()
                  ? `Files will be named: ${customFileName.trim().replace(/[^a-zA-Z0-9_-]/g, "_")}_1, ${customFileName.trim().replace(/[^a-zA-Z0-9_-]/g, "_")}_2, etc.`
                  : "Leave empty for default naming (watermarked_1, watermarked_2, ...)"}
              </p>
            </div>
          )}

          {/* Position Grid */}
          <div className="space-y-2">
            <Label>Position</Label>
            <PositionGrid selected={config.position} onSelect={(position) => setConfig({ ...config, position })} />
          </div>

          {/* Opacity Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Opacity</Label>
              <span className="text-foreground text-sm font-medium">{Math.round(config.opacity * 100)}%</span>
            </div>
            <div className="px-1">
              <Slider
                value={[config.opacity]}
                onValueChange={([value]) => setConfig({ ...config, opacity: value })}
                min={0}
                max={1}
                step={0.01}
                className="w-full"
              />
            </div>
          </div>

          {/* Size Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Size</Label>
              <span className="text-foreground text-sm font-medium">{config.size}%</span>
            </div>
            <div className="px-1">
              <Slider
                value={[config.size]}
                onValueChange={([value]) => setConfig({ ...config, size: value })}
                min={5}
                max={50}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-4">
            {mediaType === "image" && mediaFiles.length > 1 ? (
              <>
                <Button
                  onClick={() => handleApplyWatermark(false)}
                  disabled={!mediaFile || isProcessing}
                  className="w-full"
                  size="lg"
                  variant="default"
                >
                  {isProcessing ? "Processing..." : "Apply to Current Image"}
                </Button>
                <Button
                  onClick={() => handleApplyWatermark(true)}
                  disabled={!mediaFile || isProcessing}
                  className="w-full"
                  size="lg"
                  variant="outline"
                >
                  {isProcessing ? "Processing..." : `Apply to All ${mediaFiles.length} Images`}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => handleApplyWatermark(false)}
                disabled={!mediaFile || isProcessing}
                className="w-full"
                size="lg"
                variant="default"
              >
                {isProcessing ? "Processing..." : "Apply Watermark"}
              </Button>
            )}
            {processedUrl && (
              <Button onClick={handleDownload} variant="outline" className="w-full bg-transparent" size="lg">
                Download Result
              </Button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Right Section - Preview */}
      <main className="flex-1 overflow-auto p-6">
        <div className="flex h-full flex-col gap-4">
          <div className="flex-1">
            <MediaPreview
              mediaFile={mediaFile}
              mediaType={mediaType}
              watermarkPath={selectedWatermark}
              config={config}
              processedUrl={processedUrl}
              onUpload={handleMediaUpload}
            />
          </div>

          {/* Image Gallery - Only show for multiple images */}
          {mediaType === "image" && mediaFiles.length > 0 && (
            <ImageGallery
              images={mediaFiles}
              selectedIndex={selectedImageIndex}
              onSelect={handleImageSelect}
              onRemove={handleRemoveImage}
              onClearAll={handleClearAllImages}
            />
          )}
        </div>
      </main>
    </div>
  )
}
