import { logger } from "@/lib/logger"

const log = logger("lib-convert-image")

/**
 * Checks if a file is a HEIC/HEIF image
 */
export function isHEICImage(file: File): boolean {
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return type === "image/heic" || type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif")
}

/**
 * Checks if a file needs conversion to a standard web format
 */
export function needsConversion(file: File): boolean {
  return isHEICImage(file)
}

/**
 * Converts HEIC/HEIF images to JPEG for processing
 * Returns the original file if no conversion is needed
 */
export async function convertImageIfNeeded(file: File): Promise<File> {
  // If it's not HEIC/HEIF, return as-is
  if (!isHEICImage(file)) {
    return file
  }

  try {
    // Validate file size (heic2any has issues with very large files)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB.`)
    }

    // Dynamically import heic2any only when needed (client-side only)
    const heic2any = (await import("heic2any")).default

    log.debug(`Converting ${file.name} (${(file.size / 1024).toFixed(1)}KB)...`)

    // Convert HEIC to JPEG blob with multiple quality options
    let convertedBlob: Blob | Blob[]
    try {
      // Try high quality first
      convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.9,
      })
    } catch (highQualityError) {
      log.warn("High quality conversion failed, trying lower quality:", highQualityError)
      // Fallback to lower quality
      convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.7,
      })
    }

    // heic2any can return Blob or Blob[], handle both cases
    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob

    if (!blob) {
      throw new Error("Conversion resulted in empty blob")
    }

    // Create a new File from the converted blob
    const originalName = file.name.replace(/\.(heic|heif)$/i, ".jpg")
    const convertedFile = new File([blob], originalName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    })

    log.debug(`Successfully converted ${file.name} to ${originalName}`)
    return convertedFile
  } catch (error) {
    log.error("Failed to convert HEIC image:", error)

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes("File too large")) {
        throw error
      }
      if (error.message.includes("not a HEIC")) {
        throw new Error(`${file.name} appears to be corrupted or not a valid HEIC file.`)
      }
      if (error.message.includes("network") || error.message.includes("fetch")) {
        throw new Error(`Network error while converting ${file.name}. Please check your connection.`)
      }
    }

    throw new Error(
      `Failed to convert ${file.name}. The file may be corrupted or in an unsupported format. Please try converting it to JPG/PNG first using your device's photo app.`
    )
  }
}

/**
 * Converts multiple images, handling HEIC conversion as needed
 */
export async function convertImagesIfNeeded(files: File[]): Promise<File[]> {
  const conversions = files.map((file) => convertImageIfNeeded(file))
  return Promise.all(conversions)
}
