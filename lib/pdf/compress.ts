/**
 * PDF compression in the browser: re-encode the photos and scans inside a PDF
 * as smaller JPEGs. Text, fonts and vector drawings are left exactly as they
 * are, so the text stays selectable and sharp.
 *
 * This is where nearly all the bytes are in the files staff need to shrink
 * (scanned letters, photo reports). A text-only PDF has no images and barely
 * shrinks — Ghostscript would not do much better there either. The image
 * handling is deliberately conservative: anything unusual (CMYK, masks, decode
 * arrays, 16-bit, PNG predictors) is skipped rather than risk a broken page.
 *
 * The encoder is injected so the PDF surgery can be tested under Node; the
 * real one draws onto a canvas and is browser-only.
 */
import {
  PDFArray,
  PDFBool,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  decodePDFRawStream,
} from "pdf-lib"
import { canvasToBytes, loadPdf } from "./client-tools"

export interface CompressLevel {
  /** Longest side, in pixels, an image may keep. */
  maxSide: number
  /** JPEG quality, 0–1. */
  quality: number
}

/** Tried lightest first; compression stops at the first level that meets the target. */
export const COMPRESS_LEVELS: CompressLevel[] = [
  { maxSide: 2400, quality: 0.8 },
  { maxSide: 1800, quality: 0.7 },
  { maxSide: 1400, quality: 0.6 },
  { maxSide: 1100, quality: 0.5 },
  { maxSide: 800, quality: 0.4 },
]

/** An image as stored in the PDF: JPEG bytes, or raw 8-bit gray/RGB pixels. */
export type SourceImage =
  | { kind: "jpeg"; bytes: Uint8Array; width: number; height: number }
  | { kind: "pixels"; pixels: Uint8Array; channels: 1 | 3; width: number; height: number }

/** Re-encode an image as an RGB JPEG at the given level. */
export type ImageEncoder = (
  image: SourceImage,
  level: CompressLevel
) => Promise<{ bytes: Uint8Array; width: number; height: number }>

const name = (value: string) => PDFName.of(value)

function filterNames(dict: PDFDict): string[] {
  const filter = dict.lookup(name("Filter"))
  if (filter instanceof PDFName) return [filter.decodeText()]
  if (filter instanceof PDFArray) {
    return filter.asArray().map((_, i) => filter.lookup(i, PDFName).decodeText())
  }
  return []
}

/** 1 or 3 for gray/RGB images (plain or ICC-tagged); null for anything else. */
function colorChannels(dict: PDFDict): 1 | 3 | null {
  const space = dict.lookup(name("ColorSpace"))
  if (space === name("DeviceGray")) return 1
  if (space === name("DeviceRGB")) return 3
  if (space instanceof PDFArray && space.lookup(0) === name("ICCBased")) {
    const profile = space.lookup(1)
    const n = profile instanceof PDFRawStream ? profile.dict.lookup(name("N")) : undefined
    const channels = n instanceof PDFNumber ? n.asNumber() : 0
    return channels === 1 || channels === 3 ? channels : null
  }
  return null
}

/** The image if it is one we can safely re-encode, otherwise null. */
export function readSourceImage(stream: PDFRawStream): SourceImage | null {
  const dict = stream.dict
  const width = dict.lookup(name("Width"))
  const height = dict.lookup(name("Height"))
  const bits = dict.lookup(name("BitsPerComponent"))
  if (!(width instanceof PDFNumber) || !(height instanceof PDFNumber) || !(bits instanceof PDFNumber)) return null
  if (bits.asNumber() !== 8) return null
  if (dict.lookup(name("ImageMask")) === PDFBool.True) return null
  // Colour-key / stencil masks and decode arrays depend on exact pixel values.
  if (dict.has(name("Mask")) || dict.has(name("Decode"))) return null
  const channels = colorChannels(dict)
  if (!channels) return null

  const w = width.asNumber()
  const h = height.asNumber()
  const filters = filterNames(dict)
  if (filters.length === 1 && filters[0] === "DCTDecode") {
    return { kind: "jpeg", bytes: stream.getContents(), width: w, height: h }
  }
  if (filters.length === 1 && filters[0] === "FlateDecode") {
    // pdf-lib's decoder ignores PNG predictors, so predicted images are skipped.
    const params = dict.lookup(name("DecodeParms"))
    const predictor = params instanceof PDFDict ? params.lookup(name("Predictor")) : undefined
    if (predictor instanceof PDFNumber && predictor.asNumber() > 1) return null
    const pixels = decodePDFRawStream(stream).decode()
    if (pixels.length < w * h * channels) return null
    return { kind: "pixels", pixels, channels, width: w, height: h }
  }
  return null
}

function imageStreams(pdf: PDFDocument): Array<[PDFRef, PDFRawStream]> {
  const images: Array<[PDFRef, PDFRawStream]> = []
  for (const [ref, object] of pdf.context.enumerateIndirectObjects()) {
    if (object instanceof PDFRawStream && object.dict.lookup(name("Subtype")) === name("Image")) {
      images.push([ref, object])
    }
  }
  return images
}

/**
 * One pass at one level. Each image is replaced only when the new JPEG is
 * smaller than what is already stored.
 */
export async function compressImagesAtLevel(
  original: Uint8Array,
  level: CompressLevel,
  encode: ImageEncoder
): Promise<{ bytes: Uint8Array; imagesFound: number; imagesShrunk: number }> {
  const pdf = await loadPdf(original)
  let imagesFound = 0
  let imagesShrunk = 0
  for (const [ref, stream] of imageStreams(pdf)) {
    const source = readSourceImage(stream)
    if (!source) continue
    imagesFound++
    const encoded = await encode(source, level)
    if (encoded.bytes.length >= stream.getContentsSize()) continue

    const dict = stream.dict.clone(pdf.context)
    dict.set(name("Width"), PDFNumber.of(encoded.width))
    dict.set(name("Height"), PDFNumber.of(encoded.height))
    dict.set(name("Filter"), name("DCTDecode"))
    dict.set(name("ColorSpace"), name("DeviceRGB"))
    dict.set(name("BitsPerComponent"), PDFNumber.of(8))
    dict.delete(name("DecodeParms"))
    dict.set(name("Length"), PDFNumber.of(encoded.bytes.length))
    pdf.context.assign(ref, PDFRawStream.of(dict, encoded.bytes))
    imagesShrunk++
  }
  return { bytes: await pdf.save(), imagesFound, imagesShrunk }
}

export interface CompressResult {
  bytes: Uint8Array
  /** False when the PDF has no photos or scans this tool can shrink. */
  hadImages: boolean
}

/**
 * Shrink the PDF towards `targetBytes`, trying gentler levels first so the
 * result keeps as much quality as the target allows. Returns the smallest
 * result found, which may still be above the target.
 */
export async function compressPdf(
  data: Blob | Uint8Array,
  targetBytes: number,
  encode: ImageEncoder = encodeJpegInBrowser,
  onLevel?: (level: number, total: number) => void
): Promise<CompressResult> {
  const original = data instanceof Uint8Array ? data : new Uint8Array(await data.arrayBuffer())
  let best = original
  for (const [index, level] of COMPRESS_LEVELS.entries()) {
    onLevel?.(index + 1, COMPRESS_LEVELS.length)
    const pass = await compressImagesAtLevel(original, level, encode)
    if (pass.bytes.length < best.length) best = pass.bytes
    if (pass.imagesFound === 0) return { bytes: best, hadImages: false }
    if (best.length <= targetBytes) break
  }
  return { bytes: best, hadImages: true }
}

/** Canvas-based encoder (browser only). Never enlarges; flattens onto white. */
export const encodeJpegInBrowser: ImageEncoder = async (image, level) => {
  let bitmap: ImageBitmap
  if (image.kind === "jpeg") {
    // PDF viewers ignore EXIF orientation, so the browser must too.
    bitmap = await createImageBitmap(new Blob([image.bytes as BlobPart], { type: "image/jpeg" }), {
      imageOrientation: "none",
    })
  } else {
    const rgba = new Uint8ClampedArray(image.width * image.height * 4)
    for (let i = 0, p = 0; i < rgba.length; i += 4, p += image.channels) {
      rgba[i] = image.pixels[p]
      rgba[i + 1] = image.pixels[image.channels === 3 ? p + 1 : p]
      rgba[i + 2] = image.pixels[image.channels === 3 ? p + 2 : p]
      rgba[i + 3] = 255
    }
    bitmap = await createImageBitmap(new ImageData(rgba, image.width, image.height))
  }
  const scale = Math.min(1, level.maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Could not process images in this browser")
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const bytes = await canvasToBytes(canvas, "image/jpeg", level.quality)
  const result = { bytes, width: canvas.width, height: canvas.height }
  canvas.width = canvas.height = 0
  return result
}
