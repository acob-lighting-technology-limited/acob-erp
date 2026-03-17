"use client"

import type React from "react"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PositionGrid } from "@/components/position-grid"
import type { WatermarkConfig, WatermarkPreset } from "@/components/watermark-studio"

interface WatermarkItem {
  id: string
  name: string
  path: string
}

interface WatermarkSidebarProps {
  config: WatermarkConfig
  onConfigChange: (config: WatermarkConfig) => void
  watermarks: WatermarkItem[]
  selectedWatermark: string
  onWatermarkChange: (path: string) => void
  onWatermarkUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  presets: WatermarkPreset[]
  selectedPreset: string
  onPresetChange: (presetId: string) => void
  mediaType: "image" | "video" | null
  mediaFiles: File[]
  mediaFile: File | null
  customFileName: string
  onCustomFileNameChange: (name: string) => void
  isProcessing: boolean
  processedUrl: string | null
  onApplyWatermark: (applyToAll?: boolean) => void
  onDownload: () => void
}

export function WatermarkSidebar({
  config,
  onConfigChange,
  watermarks,
  selectedWatermark,
  onWatermarkChange,
  onWatermarkUpload,
  presets,
  selectedPreset,
  onPresetChange,
  mediaType,
  mediaFiles,
  mediaFile,
  customFileName,
  onCustomFileNameChange,
  isProcessing,
  processedUrl,
  onApplyWatermark,
  onDownload,
}: WatermarkSidebarProps) {
  return (
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

        {/* Preset Selection */}
        <div className="space-y-2">
          <Label>Watermark Preset</Label>
          <Select value={selectedPreset} onValueChange={onPresetChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {presets.map((preset) => (
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
            <Select value={selectedWatermark} onValueChange={onWatermarkChange}>
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
            <Button size="icon" variant="outline" onClick={() => document.getElementById("watermark-upload")?.click()}>
              <Plus className="h-4 w-4" />
            </Button>
            <input id="watermark-upload" type="file" accept="image/*" className="hidden" onChange={onWatermarkUpload} />
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
              onChange={(e) => onCustomFileNameChange(e.target.value)}
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
          <PositionGrid selected={config.position} onSelect={(position) => onConfigChange({ ...config, position })} />
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
              onValueChange={([value]) => onConfigChange({ ...config, opacity: value })}
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
              onValueChange={([value]) => onConfigChange({ ...config, size: value })}
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
                onClick={() => onApplyWatermark(false)}
                disabled={!mediaFile || isProcessing}
                className="w-full"
                size="lg"
                variant="default"
              >
                {isProcessing ? "Processing..." : "Apply to Current Image"}
              </Button>
              <Button
                onClick={() => onApplyWatermark(true)}
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
              onClick={() => onApplyWatermark(false)}
              disabled={!mediaFile || isProcessing}
              className="w-full"
              size="lg"
              variant="default"
            >
              {isProcessing ? "Processing..." : "Apply Watermark"}
            </Button>
          )}
          {processedUrl && (
            <Button onClick={onDownload} variant="outline" className="w-full bg-transparent" size="lg">
              Download Result
            </Button>
          )}
        </div>
      </div>
    </motion.aside>
  )
}
