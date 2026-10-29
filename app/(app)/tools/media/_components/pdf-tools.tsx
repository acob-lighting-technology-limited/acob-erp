"use client"

import { useEffect, useState } from "react"
import { saveAs } from "file-saver"
import { toast } from "sonner"
import {
  extractPdfText,
  imagesToPdf,
  mergePdfs,
  pdfToDocx,
  pdfToImages,
  resizeImageToPng,
  splitPdf,
  toPdfBlob,
  watermarkPdf,
  type PageImageFormat,
} from "@/lib/pdf/client-tools"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Merge,
  Scissors,
  Minimize2,
  Image as ImageIcon,
  FileImage,
  Type,
  FileCode,
  Key,
  FileText,
  Loader2,
  ArrowUp,
  ArrowDown,
  Trash2,
} from "lucide-react"

type PdfToolType =
  | "merge"
  | "split"
  | "compress"
  | "convert"
  | "images-to-pdf"
  | "extract-text"
  | "to-doc"
  | "watermark"
  | "password"
  | "ocr"

/** Human-readable byte size, e.g. 3,007,168 → "2.87 MB". */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, exponent)
  return `${value.toFixed(exponent === 0 ? 0 : 2)} ${units[exponent]}`
}

/**
 * Every tool runs on the user's device, so there is no upload limit — only the
 * device's memory. Above this size, warn (never block) that a phone may run out.
 */
const LARGE_FILE_BYTES = 100 * 1024 * 1024

/** Outcome a tool can report instead of the default success toast. */
type ToolOutcome = { message: string; warning?: boolean } | void

export function PdfTools() {
  const [toolType, setToolType] = useState<PdfToolType>("merge")
  const [pdfFiles, setPdfFiles] = useState<File[]>([])
  const [singlePdfFile, setSinglePdfFile] = useState<File | null>(null)
  // Object URL for the selected PDF so the operator can see the document they
  // are about to split, page-number it, and pick ranges with confidence.
  const [singlePdfPreviewUrl, setSinglePdfPreviewUrl] = useState<string | null>(null)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [splitPages, setSplitPages] = useState("")
  const [convertFormat, setConvertFormat] = useState<PageImageFormat>("jpg")
  const [compressionMode, setCompressionMode] = useState<"size" | "percentage">("size")
  const [compressionResult, setCompressionResult] = useState<{
    originalSize: number
    compressedSize: number
    targetBytes: number
    targetMissed: boolean
    hadImages: boolean
  } | null>(null)
  const [targetSize, setTargetSize] = useState("")
  const [sizeUnit, setSizeUnit] = useState<"KB" | "MB" | "GB">("MB")
  const [percentage, setPercentage] = useState("50")
  const [processing, setProcessing] = useState(false)
  const [extractedText, setExtractedText] = useState("")
  const [watermarkType, setWatermarkType] = useState<"text" | "image">("text")
  const [watermarkText, setWatermarkText] = useState("")
  const [watermarkImage, setWatermarkImage] = useState<File | null>(null)
  const [watermarkPosition, setWatermarkPosition] = useState<"center" | "top" | "bottom" | "custom">("center")
  const [watermarkX, setWatermarkX] = useState("0")
  const [watermarkY, setWatermarkY] = useState("0")
  const [watermarkFontSize, setWatermarkFontSize] = useState("48")
  const [watermarkOpacity, setWatermarkOpacity] = useState("0.5")
  const [watermarkColor, setWatermarkColor] = useState("000000")
  // -45 reproduces the long-standing slanted watermark; 0 is horizontal.
  const [watermarkRotation, setWatermarkRotation] = useState("-45")
  const [passwordAction, setPasswordAction] = useState<"protect" | "remove">("protect")
  const [pdfPassword, setPdfPassword] = useState("")
  const [ocrOutputFormat, setOcrOutputFormat] = useState<"text" | "pdf">("text")
  const [ocrText, setOcrText] = useState("")

  const selectedBytes =
    pdfFiles.reduce((total, f) => total + f.size, 0) +
    imageFiles.reduce((total, f) => total + f.size, 0) +
    (singlePdfFile?.size ?? 0)

  /**
   * Run a tool with the shared processing state and toasts. `work` gets a
   * `progress` callback for long jobs (OCR, convert) and may return its own
   * outcome message.
   */
  const runInBrowser = async (
    loading: string,
    success: string,
    failure: string,
    work: (progress: (message: string) => void) => Promise<ToolOutcome>
  ) => {
    setProcessing(true)
    const toastId = toast.loading(loading)
    try {
      const outcome = await work((message) => toast.loading(message, { id: toastId }))
      if (outcome?.warning) toast.warning(outcome.message, { id: toastId, duration: 8000 })
      else toast.success(outcome?.message ?? success, { id: toastId })
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : failure, { id: toastId })
    } finally {
      setProcessing(false)
    }
  }

  const handlePdfFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const pdfs = files.filter((f) => f.type === "application/pdf")
    if (pdfs.length > 0) {
      setPdfFiles(pdfs)
      toast.success(`${pdfs.length} PDF file(s) selected`)
    } else {
      toast.error("Please select PDF files")
    }
  }

  const handleSinglePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === "application/pdf") {
      setSinglePdfFile(file)
      setSinglePdfPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous)
        return URL.createObjectURL(file)
      })
      toast.success("PDF file selected")
    } else {
      toast.error("Please select a PDF file")
    }
  }

  // Release the last object URL when the component goes away.
  useEffect(() => {
    return () => {
      if (singlePdfPreviewUrl) URL.revokeObjectURL(singlePdfPreviewUrl)
    }
  }, [singlePdfPreviewUrl])

  const handleImageFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const images = files.filter((f) => f.type.startsWith("image/"))
    if (images.length > 0) {
      setImageFiles(images)
      toast.success(`${images.length} image(s) selected`)
    } else {
      toast.error("Please select image files")
    }
  }

  const handleMerge = async () => {
    if (pdfFiles.length < 2) {
      toast.error("Please select at least 2 PDF files to merge")
      return
    }
    await runInBrowser("Merging PDFs...", "PDFs merged successfully!", "Merge failed", async () => {
      const merged = await mergePdfs(pdfFiles.map((file) => ({ name: file.name, data: file })))
      saveAs(toPdfBlob(merged), `merged_${Date.now()}.pdf`)
    })
  }

  const handleSplit = async () => {
    if (!singlePdfFile) {
      toast.error("Please select a PDF file")
      return
    }
    if (!splitPages.trim()) {
      toast.error("Please enter page ranges (e.g., 1-5, 10-15)")
      return
    }
    await runInBrowser("Splitting PDF...", "PDF split successfully!", "Split failed", async () => {
      const split = await splitPdf(singlePdfFile, splitPages)
      saveAs(toPdfBlob(split), `split_${singlePdfFile.name.replace(/\.pdf$/i, "")}_${Date.now()}.pdf`)
    })
  }

  const handleCompress = async () => {
    if (!singlePdfFile) {
      toast.error("Please select a PDF file")
      return
    }
    if (compressionMode === "size" && !targetSize) {
      toast.error("Please enter target size")
      return
    }
    if (
      compressionMode === "percentage" &&
      (!percentage || parseFloat(percentage) <= 0 || parseFloat(percentage) >= 100)
    ) {
      toast.error("Please enter a valid percentage (1-99)")
      return
    }
    setCompressionResult(null)
    await runInBrowser("Compressing PDF...", "PDF compressed", "Compression failed", async (progress) => {
      const originalSize = singlePdfFile.size
      const targetBytes =
        compressionMode === "size"
          ? parseFloat(targetSize) * (sizeUnit === "KB" ? 1024 : sizeUnit === "GB" ? 1024 ** 3 : 1024 ** 2)
          : originalSize * (1 - parseFloat(percentage) / 100)

      const { compressPdf } = await import("@/lib/pdf/compress")
      const { bytes, hadImages } = await compressPdf(singlePdfFile, targetBytes, undefined, (level, total) =>
        progress(`Compressing PDF... (pass ${level} of ${total})`)
      )
      saveAs(toPdfBlob(bytes), `compressed_${singlePdfFile.name}`)

      // Report the sizes rather than a bare "success", so a missed target is visible.
      const reduction = originalSize > 0 ? ((originalSize - bytes.length) / originalSize) * 100 : 0
      const sizeSummary = `${formatBytes(originalSize)} → ${formatBytes(bytes.length)} (${reduction.toFixed(1)}% smaller)`
      const targetMissed = bytes.length > targetBytes
      setCompressionResult({ originalSize, compressedSize: bytes.length, targetBytes, targetMissed, hadImages })
      return targetMissed
        ? { message: `Target not reached. ${sizeSummary}`, warning: true }
        : { message: `PDF compressed. ${sizeSummary}` }
    })
  }

  const handleConvert = async () => {
    if (!singlePdfFile) {
      toast.error("Please select a PDF file")
      return
    }
    await runInBrowser(
      "Converting PDF to images...",
      "PDF converted successfully!",
      "Conversion failed",
      async (progress) => {
        const zip = await pdfToImages(singlePdfFile, convertFormat, (page, total) =>
          progress(`Converting page ${page} of ${total}...`)
        )
        saveAs(zip, `${singlePdfFile.name.replace(/\.pdf$/i, "")}_images.zip`)
      }
    )
  }

  // Thumbnails for the images-to-PDF picker. Page order follows array order,
  // so reordering here reorders the generated PDF.
  useEffect(() => {
    const urls = imageFiles.map((file) => URL.createObjectURL(file))
    setImagePreviews(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [imageFiles])

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= imageFiles.length) return
    setImageFiles((previous) => {
      const next = [...previous]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const removeImage = (index: number) => {
    setImageFiles((previous) => previous.filter((_, i) => i !== index))
  }

  const handleImagesToPdf = async () => {
    if (imageFiles.length === 0) {
      toast.error("Please select at least one image file")
      return
    }
    await runInBrowser(
      "Converting images to PDF...",
      "Images converted to PDF successfully!",
      "Conversion failed",
      async () => {
        const pdf = await imagesToPdf(imageFiles.map((file) => ({ name: file.name, data: file })))
        saveAs(toPdfBlob(pdf), `images_${Date.now()}.pdf`)
      }
    )
  }

  const handleExtractText = async () => {
    if (!singlePdfFile) {
      toast.error("Please select a PDF file")
      return
    }
    setExtractedText("")
    await runInBrowser("Extracting text...", "Text extracted successfully!", "Text extraction failed", async () => {
      const { pages } = await extractPdfText(singlePdfFile)
      const text = pages.join("\n\n").trim()
      setExtractedText(text || "No selectable text found. If this is a scanned PDF, use OCR.")
    })
  }

  const handlePdfToDoc = async () => {
    if (!singlePdfFile) {
      toast.error("Please select a PDF file")
      return
    }
    await runInBrowser(
      "Converting PDF to DOCX...",
      "PDF converted to DOCX successfully!",
      "Conversion failed",
      async () => {
        const docx = await pdfToDocx(singlePdfFile)
        saveAs(docx, `${singlePdfFile.name.replace(/\.pdf$/i, "")}_${Date.now()}.docx`)
      }
    )
  }

  const handleWatermark = async () => {
    if (!singlePdfFile) {
      toast.error("Please select a PDF file")
      return
    }
    if (watermarkType === "text" && !watermarkText) {
      toast.error("Please enter watermark text")
      return
    }
    if (watermarkType === "image" && !watermarkImage) {
      toast.error("Please select a watermark image")
      return
    }
    await runInBrowser("Adding watermark...", "Watermark added successfully!", "Watermarking failed", async () => {
      const rotation = parseFloat(watermarkRotation)
      const watermarked = await watermarkPdf(singlePdfFile, {
        text: watermarkType === "text" ? watermarkText : undefined,
        image: watermarkType === "image" && watermarkImage ? await resizeImageToPng(watermarkImage, 200) : undefined,
        position: watermarkPosition,
        x: parseFloat(watermarkX) || 0,
        y: parseFloat(watermarkY) || 0,
        fontSize: parseFloat(watermarkFontSize) || 48,
        opacity: parseFloat(watermarkOpacity) || 0.5,
        rotation: Number.isFinite(rotation) ? rotation : -45,
        color: watermarkColor,
      })
      saveAs(toPdfBlob(watermarked), `watermarked_${singlePdfFile.name}`)
    })
  }

  const handlePassword = async () => {
    if (!singlePdfFile) {
      toast.error("Please select a PDF file")
      return
    }
    if (!pdfPassword) {
      toast.error("Please enter a password")
      return
    }
    const protect = passwordAction === "protect"
    await runInBrowser(
      protect ? "Protecting PDF..." : "Removing password...",
      protect ? "Password added" : "Password removed",
      "Password operation failed",
      async () => {
        const { protectPdf, unlockPdf } = await import("@/lib/pdf/password")
        const output = protect
          ? await protectPdf(singlePdfFile, pdfPassword)
          : await unlockPdf(singlePdfFile, pdfPassword)
        saveAs(toPdfBlob(output), `${protect ? "protected" : "unprotected"}_${singlePdfFile.name}`)
      }
    )
  }

  const handleOcr = async () => {
    if (!singlePdfFile) {
      toast.error("Please select a PDF file")
      return
    }
    setOcrText("")
    await runInBrowser("Loading OCR engine...", "OCR complete", "OCR failed", async (progress) => {
      const { ocrPdf } = await import("@/lib/pdf/ocr")
      const { text, pdf } = await ocrPdf(singlePdfFile, {
        searchablePdf: ocrOutputFormat === "pdf",
        onPage: (page, total) => progress(`Reading page ${page} of ${total}...`),
      })
      if (pdf) saveAs(toPdfBlob(pdf), `ocr_${singlePdfFile.name}`)
      else setOcrText(text || "No text was recognised. The scan may be too faint or blurred.")
    })
  }

  return (
    <div className="space-y-6">
      {/* Tool Selector Buttons */}
      <div className="bg-muted flex max-w-full flex-wrap gap-2 rounded-lg p-1">
        {(
          [
            "merge",
            "split",
            "compress",
            "convert",
            "images-to-pdf",
            "extract-text",
            "to-doc",
            "watermark",
            "password",
            "ocr",
          ] as PdfToolType[]
        ).map((t) => (
          <Button
            key={t}
            variant={toolType === t ? "secondary" : "ghost"}
            size="sm"
            className="px-3 text-xs capitalize"
            onClick={() => {
              setToolType(t)
              setPdfFiles([])
              setSinglePdfFile(null)
              setImageFiles([])
            }}
          >
            {t.replace("-", " ")}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="capitalize">{toolType.replace("-", " ")} PDF</CardTitle>
            <CardDescription>
              Processed on your device — the file is not uploaded and there is no size limit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedBytes > LARGE_FILE_BYTES && (
              <div role="status" className="border-warning/30 bg-warning/15 text-warning rounded-lg border p-3 text-sm">
                This is a large file ({formatBytes(selectedBytes)}). If it fails on a phone, try a laptop or desktop.
              </div>
            )}
            {/* Input upload sections based on tool type */}
            {toolType === "merge" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select multiple PDF files</label>
                  <Input type="file" accept="application/pdf" multiple onChange={handlePdfFilesChange} />
                  {pdfFiles.length > 0 && (
                    <div className="text-muted-foreground space-y-0.5 text-xs">
                      <div>
                        {pdfFiles.length} file(s) selected —{" "}
                        {formatBytes(pdfFiles.reduce((total, f) => total + f.size, 0))} total
                      </div>
                      {pdfFiles.map((f) => (
                        <div key={f.name}>
                          {f.name} — {formatBytes(f.size)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button className="w-full" onClick={handleMerge} disabled={pdfFiles.length < 2 || processing}>
                  {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Merge className="mr-2 h-4 w-4" />}
                  Merge PDFs
                </Button>
              </div>
            )}

            {toolType === "split" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select PDF file</label>
                  <Input type="file" accept="application/pdf" onChange={handleSinglePdfChange} />
                  {singlePdfFile && (
                    <div className="text-muted-foreground text-xs">
                      {singlePdfFile.name} — {formatBytes(singlePdfFile.size)}
                    </div>
                  )}
                </div>
                {singlePdfPreviewUrl && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preview</label>
                    <iframe
                      src={singlePdfPreviewUrl}
                      title={`Preview of ${singlePdfFile?.name || "selected PDF"}`}
                      className="h-[420px] w-full rounded-md border"
                    />
                    <p className="text-muted-foreground text-xs">
                      Scroll to find the pages you want, then enter their numbers below.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Page Ranges</label>
                  <Input
                    placeholder="e.g. 1-3, 5, 7-10"
                    value={splitPages}
                    onChange={(e) => setSplitPages(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSplit}
                  disabled={!singlePdfFile || !splitPages.trim() || processing}
                >
                  {processing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Scissors className="mr-2 h-4 w-4" />
                  )}
                  Split PDF
                </Button>
              </div>
            )}

            {toolType === "compress" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select PDF file</label>
                  <Input type="file" accept="application/pdf" onChange={handleSinglePdfChange} />
                  {singlePdfFile && (
                    <div className="text-muted-foreground text-xs">
                      {singlePdfFile.name} — {formatBytes(singlePdfFile.size)}
                    </div>
                  )}
                </div>
                <div className="bg-muted mb-2 flex w-full rounded-lg p-1">
                  <Button
                    variant={compressionMode === "size" ? "secondary" : "ghost"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setCompressionMode("size")}
                  >
                    Target Size
                  </Button>
                  <Button
                    variant={compressionMode === "percentage" ? "secondary" : "ghost"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setCompressionMode("percentage")}
                  >
                    Percentage
                  </Button>
                </div>
                {compressionMode === "size" ? (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Enter target size"
                      value={targetSize}
                      onChange={(e) => setTargetSize(e.target.value)}
                      className="flex-1"
                    />
                    <select
                      value={sizeUnit}
                      onChange={(e: any) => setSizeUnit(e.target.value)}
                      className="bg-background w-24 rounded border px-2 text-sm"
                    >
                      <option value="KB">KB</option>
                      <option value="MB">MB</option>
                    </select>
                  </div>
                ) : (
                  <Input
                    type="number"
                    placeholder="Reduction (1-99%)"
                    value={percentage}
                    onChange={(e) => setPercentage(e.target.value)}
                  />
                )}
                <Button className="w-full" onClick={handleCompress} disabled={!singlePdfFile || processing}>
                  {processing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Minimize2 className="mr-2 h-4 w-4" />
                  )}
                  Compress PDF
                </Button>
                {compressionResult && (
                  <div
                    className={
                      compressionResult.targetMissed
                        ? "border-warning/30 bg-warning/15 rounded-lg border p-3 text-xs"
                        : "rounded-lg border p-3 text-xs"
                    }
                  >
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span>Original: {formatBytes(compressionResult.originalSize)}</span>
                      <span>Result: {formatBytes(compressionResult.compressedSize)}</span>
                      <span>Target: {formatBytes(compressionResult.targetBytes)}</span>
                    </div>
                    {compressionResult.targetMissed && (
                      <p className="text-warning mt-2">
                        {compressionResult.hadImages
                          ? "The target could not be reached. This is as small as the images can go and still be readable."
                          : "This PDF has no photos or scans to shrink. Text-only PDFs are already compact."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {toolType === "convert" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select PDF file</label>
                  <Input type="file" accept="application/pdf" onChange={handleSinglePdfChange} />
                  {singlePdfFile && (
                    <div className="text-muted-foreground text-xs">
                      {singlePdfFile.name} — {formatBytes(singlePdfFile.size)}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Image Format</label>
                  <select
                    value={convertFormat}
                    onChange={(e) => setConvertFormat(e.target.value as PageImageFormat)}
                    className="bg-background w-full rounded border p-2 text-sm"
                  >
                    <option value="jpg">JPEG (.jpg)</option>
                    <option value="png">PNG (.png)</option>
                    <option value="webp">WebP (.webp)</option>
                  </select>
                </div>
                <Button className="w-full" onClick={handleConvert} disabled={!singlePdfFile || processing}>
                  {processing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="mr-2 h-4 w-4" />
                  )}
                  Convert PDF to Images (ZIP)
                </Button>
              </div>
            )}

            {toolType === "images-to-pdf" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Images</label>
                  <Input type="file" accept="image/*" multiple onChange={handleImageFilesChange} />
                  {imageFiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-muted-foreground text-xs">
                        {imageFiles.length} image(s) selected —{" "}
                        {formatBytes(imageFiles.reduce((total, f) => total + f.size, 0))} total. Pages follow the order
                        below.
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {imageFiles.map((file, index) => (
                          <div key={`${file.name}-${index}`} className="space-y-1 rounded-lg border p-2">
                            <div className="bg-muted flex h-24 items-center justify-center overflow-hidden rounded">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imagePreviews[index]}
                                alt={file.name}
                                className="max-h-24 max-w-full object-contain"
                              />
                            </div>
                            <div className="text-muted-foreground truncate text-xs" title={file.name}>
                              {index + 1}. {file.name}
                            </div>
                            <div className="text-muted-foreground text-xs">{formatBytes(file.size)}</div>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                aria-label="Move earlier"
                                disabled={index === 0}
                                onClick={() => moveImage(index, index - 1)}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                aria-label="Move later"
                                disabled={index === imageFiles.length - 1}
                                onClick={() => moveImage(index, index + 1)}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                aria-label="Remove image"
                                onClick={() => removeImage(index)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Button className="w-full" onClick={handleImagesToPdf} disabled={imageFiles.length === 0 || processing}>
                  {processing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileImage className="mr-2 h-4 w-4" />
                  )}
                  Create PDF from Images
                </Button>
              </div>
            )}

            {toolType === "extract-text" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select PDF file</label>
                  <Input type="file" accept="application/pdf" onChange={handleSinglePdfChange} />
                  {singlePdfFile && (
                    <div className="text-muted-foreground text-xs">
                      {singlePdfFile.name} — {formatBytes(singlePdfFile.size)}
                    </div>
                  )}
                </div>
                {singlePdfPreviewUrl && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preview</label>
                    <iframe
                      src={singlePdfPreviewUrl}
                      title={`Preview of ${singlePdfFile?.name || "selected PDF"}`}
                      className="h-[420px] w-full rounded-md border"
                    />
                  </div>
                )}
                <Button className="w-full" onClick={handleExtractText} disabled={!singlePdfFile || processing}>
                  {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Type className="mr-2 h-4 w-4" />}
                  Extract Plain Text
                </Button>
                {extractedText && (
                  <div className="mt-4 space-y-2">
                    <label className="text-sm font-medium">Extracted Content</label>
                    <Textarea value={extractedText} readOnly className="min-h-48 font-mono text-xs" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(extractedText)
                        toast.success("Copied!")
                      }}
                    >
                      Copy to Clipboard
                    </Button>
                  </div>
                )}
              </div>
            )}

            {toolType === "to-doc" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select PDF file</label>
                  <Input type="file" accept="application/pdf" onChange={handleSinglePdfChange} />
                  {singlePdfFile && (
                    <div className="text-muted-foreground text-xs">
                      {singlePdfFile.name} — {formatBytes(singlePdfFile.size)}
                    </div>
                  )}
                </div>
                <Button className="w-full" onClick={handlePdfToDoc} disabled={!singlePdfFile || processing}>
                  {processing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileCode className="mr-2 h-4 w-4" />
                  )}
                  Convert to DOCX
                </Button>
              </div>
            )}

            {toolType === "watermark" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select PDF file</label>
                  <Input type="file" accept="application/pdf" onChange={handleSinglePdfChange} />
                  {singlePdfFile && (
                    <div className="text-muted-foreground text-xs">
                      {singlePdfFile.name} — {formatBytes(singlePdfFile.size)}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Watermark Source</label>
                  <select
                    value={watermarkType}
                    onChange={(e: any) => setWatermarkType(e.target.value)}
                    className="bg-background w-full rounded border p-2 text-sm"
                  >
                    <option value="text">Text Watermark</option>
                    <option value="image">Image Logo</option>
                  </select>
                </div>
                {watermarkType === "text" ? (
                  <Input
                    placeholder="CONFIDENTIAL, DRAFT, etc."
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                  />
                ) : (
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setWatermarkImage(e.target.files?.[0] || null)}
                  />
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Position</label>
                  <select
                    value={watermarkPosition}
                    onChange={(e: any) => setWatermarkPosition(e.target.value)}
                    className="bg-background w-full rounded border p-2 text-sm"
                  >
                    <option value="center">Center (Recommended)</option>
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                    <option value="custom">Custom Coords</option>
                  </select>
                </div>
                {watermarkPosition === "custom" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="number"
                      placeholder="X"
                      value={watermarkX}
                      onChange={(e) => setWatermarkX(e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Y"
                      value={watermarkY}
                      onChange={(e) => setWatermarkY(e.target.value)}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Font/Logo Size</label>
                    <Input
                      type="number"
                      value={watermarkFontSize}
                      onChange={(e) => setWatermarkFontSize(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Opacity (0.1 - 1)</label>
                    <Input
                      type="number"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={watermarkOpacity}
                      onChange={(e) => setWatermarkOpacity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rotation (degrees)</label>
                    <Input
                      type="number"
                      min="-180"
                      max="180"
                      step="5"
                      value={watermarkRotation}
                      onChange={(e) => setWatermarkRotation(e.target.value)}
                    />
                    <p className="text-muted-foreground text-xs">0 = horizontal, -45 = slanted (default)</p>
                  </div>
                </div>
                <Button className="w-full" onClick={handleWatermark} disabled={!singlePdfFile || processing}>
                  {processing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Add Watermark Layer
                </Button>
              </div>
            )}

            {toolType === "password" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select PDF file</label>
                  <Input type="file" accept="application/pdf" onChange={handleSinglePdfChange} />
                  {singlePdfFile && (
                    <div className="text-muted-foreground text-xs">
                      {singlePdfFile.name} — {formatBytes(singlePdfFile.size)}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Action</label>
                  <select
                    value={passwordAction}
                    onChange={(e: any) => setPasswordAction(e.target.value)}
                    className="bg-background w-full rounded border p-2 text-sm"
                  >
                    <option value="protect">Add Encryption Password</option>
                    <option value="remove">Strip/Decrypt Password</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password Key</label>
                  <Input
                    type="password"
                    placeholder="Enter security password"
                    value={pdfPassword}
                    onChange={(e) => setPdfPassword(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handlePassword}
                  disabled={!singlePdfFile || !pdfPassword || processing}
                >
                  {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
                  Execute Password Security
                </Button>
              </div>
            )}

            {toolType === "ocr" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Scanned PDF file</label>
                  <Input type="file" accept="application/pdf" onChange={handleSinglePdfChange} />
                  {singlePdfFile && (
                    <div className="text-muted-foreground text-xs">
                      {singlePdfFile.name} — {formatBytes(singlePdfFile.size)}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output Format</label>
                  <select
                    value={ocrOutputFormat}
                    onChange={(e: any) => setOcrOutputFormat(e.target.value)}
                    className="bg-background w-full rounded border p-2 text-sm"
                  >
                    <option value="text">Raw Text File</option>
                    <option value="pdf">Searchable PDF Layer</option>
                  </select>
                </div>
                <Button className="w-full" onClick={handleOcr} disabled={!singlePdfFile || processing}>
                  {processing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Perform OCR Text Extraction
                </Button>
                {ocrText && ocrOutputFormat === "text" && (
                  <div className="mt-4 space-y-2">
                    <label className="text-sm font-medium">OCR Extracted Text</label>
                    <Textarea value={ocrText} readOnly className="min-h-48 font-mono text-xs" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(ocrText)
                        toast.success("Copied!")
                      }}
                    >
                      Copy OCR Text
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sidebar help */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PDF Tools Help</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-xs leading-relaxed">
            <p>
              <strong>Merge</strong>: Combines multiple PDFs into a single continuous file. Add files in the order you
              want them merged.
            </p>
            <p>
              <strong>Split</strong>: Splits a PDF by extracting specified pages/ranges (e.g., &quot;1-3, 5, 8&quot;).
            </p>
            <p>
              <strong>Images to PDF</strong>: Packs multiple image files into pages of a single PDF file.
            </p>
            <p>
              <strong>Extract Text</strong>: Reads the selectable text in a PDF. Scanned pages have none — use OCR.
            </p>
            <p>
              <strong>Compress</strong>: Shrinks the photos and scans inside a PDF; the text stays sharp and selectable.
              Text-only PDFs barely shrink.
            </p>
            <p>
              <strong>OCR</strong>: Reads scanned pages. Takes a few seconds per page, longer on a phone.
            </p>
            <p>
              Every tool runs on your device: nothing is uploaded and there is no size limit. Very large files may be
              too much for a phone — use a laptop for those.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
