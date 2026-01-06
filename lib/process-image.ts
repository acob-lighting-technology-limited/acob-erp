import type { WatermarkConfig } from "@/components/watermark-studio"

export async function processImage(imageFile: File, watermarkPath: string, config: WatermarkConfig): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      reject(new Error("Failed to get canvas context"))
      return
    }

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = URL.createObjectURL(imageFile)

    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const watermark = new Image()
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
          "center-down-10": {
            x: (img.width - watermarkWidth) / 2,
            y: (img.height - watermarkHeight) / 2 + img.height * 0.1,
          },
          "center-down-20": {
            x: (img.width - watermarkWidth) / 2,
            y: (img.height - watermarkHeight) / 2 + img.height * 0.2,
          },
          "center-down-25": {
            x: (img.width - watermarkWidth) / 2,
            y: (img.height - watermarkHeight) / 2 + img.height * 0.25,
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

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(URL.createObjectURL(blob))
            } else {
              reject(new Error("Failed to create blob"))
            }
          },
          imageFile.type,
          0.95
        )
      }

      watermark.onerror = () => reject(new Error("Failed to load watermark"))
    }

    img.onerror = () => reject(new Error("Failed to load image"))
  })
}
