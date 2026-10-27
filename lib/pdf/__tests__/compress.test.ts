import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { PDFDocument, PDFName, PDFNumber, PDFRawStream } from "pdf-lib"
import {
  COMPRESS_LEVELS,
  compressImagesAtLevel,
  compressPdf,
  readSourceImage,
  type ImageEncoder,
  type SourceImage,
} from "../compress"

/** Stand-in for the canvas encoder: halves each side, returns `size` bytes. */
function fakeEncoder(size: number, seen: SourceImage[] = []): ImageEncoder {
  return async (image) => {
    seen.push(image)
    return {
      bytes: new Uint8Array(size).fill(7),
      width: Math.ceil(image.width / 2),
      height: Math.ceil(image.height / 2),
    }
  }
}

async function pdfWithImage(dict: Record<string, unknown>, contents: Uint8Array, flate = false) {
  const pdf = await PDFDocument.create()
  pdf.addPage()
  const stream = flate
    ? pdf.context.flateStream(contents, { Type: "XObject", Subtype: "Image", ...dict })
    : pdf.context.stream(contents, { Type: "XObject", Subtype: "Image", ...dict })
  pdf.context.register(stream)
  return pdf.save()
}

async function onlyImage(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes)
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    if (object instanceof PDFRawStream && object.dict.lookup(PDFName.of("Subtype")) === PDFName.of("Image")) {
      return object
    }
  }
  throw new Error("no image")
}

const jpegDict = { Width: 400, Height: 300, BitsPerComponent: 8, ColorSpace: "DeviceRGB", Filter: "DCTDecode" }
const bigJpeg = new Uint8Array(5000).fill(1)

describe("compressImagesAtLevel", () => {
  it("replaces a JPEG with the smaller re-encode and updates its size", async () => {
    const original = await pdfWithImage(jpegDict, bigJpeg)
    const result = await compressImagesAtLevel(original, COMPRESS_LEVELS[0], fakeEncoder(100))
    assert.equal(result.imagesFound, 1)
    assert.equal(result.imagesShrunk, 1)
    assert.ok(result.bytes.length < original.length)

    const image = await onlyImage(result.bytes)
    assert.equal(image.dict.lookup(PDFName.of("Width"), PDFNumber).asNumber(), 200)
    assert.equal(image.dict.lookup(PDFName.of("Height"), PDFNumber).asNumber(), 150)
    assert.equal(image.dict.lookup(PDFName.of("Length"), PDFNumber).asNumber(), 100)
    assert.equal(image.getContents().length, 100)
  })

  it("keeps the original when the re-encode is not smaller", async () => {
    const original = await pdfWithImage(jpegDict, new Uint8Array(50).fill(1))
    const result = await compressImagesAtLevel(original, COMPRESS_LEVELS[0], fakeEncoder(100))
    assert.equal(result.imagesShrunk, 0)
    const image = await onlyImage(result.bytes)
    assert.equal(image.dict.lookup(PDFName.of("Width"), PDFNumber).asNumber(), 400)
  })

  it("decodes flate RGB pixels for the encoder", async () => {
    const pixels = new Uint8Array(4 * 3 * 3).fill(200)
    const original = await pdfWithImage(
      { Width: 4, Height: 3, BitsPerComponent: 8, ColorSpace: "DeviceRGB" },
      pixels,
      true
    )
    const seen: SourceImage[] = []
    await compressImagesAtLevel(original, COMPRESS_LEVELS[0], fakeEncoder(1, seen))
    assert.equal(seen.length, 1)
    assert.equal(seen[0].kind, "pixels")
    if (seen[0].kind === "pixels") {
      assert.equal(seen[0].channels, 3)
      assert.deepEqual([...seen[0].pixels.slice(0, 3)], [200, 200, 200])
    }
  })
})

describe("readSourceImage", () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ["CMYK", { ...jpegDict, ColorSpace: "DeviceCMYK" }],
    ["16-bit", { ...jpegDict, BitsPerComponent: 16 }],
    ["masked", { ...jpegDict, Mask: [0, 0, 0, 0, 0, 0] }],
    ["decode array", { ...jpegDict, Decode: [1, 0, 1, 0, 1, 0] }],
    ["JPEG 2000", { ...jpegDict, Filter: "JPXDecode" }],
  ]
  for (const [label, dict] of cases) {
    it(`skips ${label} images`, async () => {
      assert.equal(readSourceImage(await onlyImage(await pdfWithImage(dict, bigJpeg))), null)
    })
  }
})

describe("compressPdf", () => {
  it("stops at the first level that meets the target", async () => {
    const original = await pdfWithImage(jpegDict, bigJpeg)
    const levels: number[] = []
    const result = await compressPdf(original, original.length, fakeEncoder(100), (level) => levels.push(level))
    assert.deepEqual(levels, [1])
    assert.equal(result.hadImages, true)
    assert.ok(result.bytes.length <= original.length)
  })

  it("tries every level when the target is out of reach, keeping the smallest", async () => {
    const original = await pdfWithImage(jpegDict, bigJpeg)
    const levels: number[] = []
    const result = await compressPdf(original, 1, fakeEncoder(100), (level) => levels.push(level))
    assert.equal(levels.length, COMPRESS_LEVELS.length)
    assert.ok(result.bytes.length < original.length)
  })

  it("reports a PDF with no images", async () => {
    const pdf = await PDFDocument.create()
    pdf.addPage()
    const result = await compressPdf(await pdf.save(), 1, fakeEncoder(1))
    assert.equal(result.hadImages, false)
  })
})
