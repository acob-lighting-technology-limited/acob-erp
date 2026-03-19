"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Trash2 } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ImageGalleryProps {
  images: File[]
  selectedIndex: number
  onSelect: (index: number) => void
  onRemove: (index: number) => void
  onClearAll: () => void
}

export function ImageGallery({ images, selectedIndex, onSelect, onRemove, onClearAll }: ImageGalleryProps) {
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map())

  // Generate thumbnails for all images
  useEffect(() => {
    const newThumbnails = new Map<string, string>()
    const promises = images.map((file) => {
      return new Promise<void>((resolve) => {
        const url = URL.createObjectURL(file)
        newThumbnails.set(file.name, url)
        resolve()
      })
    })

    Promise.all(promises).then(() => {
      setThumbnails(newThumbnails)
    })

    // Cleanup function
    return () => {
      newThumbnails.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [images])

  if (images.length === 0) return null

  return (
    <div className="border-border bg-card glass-effect space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm font-medium">
          {images.length} image{images.length === 1 ? "" : "s"} uploaded
        </p>
        <Button variant="ghost" size="sm" onClick={onClearAll} className="text-destructive hover:text-destructive h-8">
          <Trash2 className="mr-2 h-4 w-4" />
          Clear All
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <AnimatePresence mode="popLayout">
          {images.map((file, index) => {
            const thumbnailUrl = thumbnails.get(file.name)
            const isSelected = index === selectedIndex

            return (
              <motion.div
                key={file.name}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="relative flex-shrink-0"
              >
                <button
                  onClick={() => onSelect(index)}
                  className={cn(
                    "bg-muted relative h-20 w-20 overflow-hidden rounded-lg border-2 transition-all hover:scale-105",
                    isSelected ? "border-primary ring-primary ring-2 ring-offset-2" : "border-transparent"
                  )}
                >
                  {thumbnailUrl ? (
                    <Image src={thumbnailUrl} alt={file.name} fill unoptimized className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="text-muted-foreground text-xs">Loading...</span>
                    </div>
                  )}
                </button>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(index)
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-transform hover:scale-110"
                  aria-label="Remove image"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
