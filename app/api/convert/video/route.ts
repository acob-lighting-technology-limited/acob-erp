import { NextRequest, NextResponse } from "next/server"
import { run } from "@/lib/shell/run"
import { readFile, unlink, writeFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { tmpdir } from "os"

export async function POST(request: NextRequest) {
  let tempFile: string | null = null
  let outputFile: string | null = null

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const format = formData.get("format") as string

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    // format lands in the output path, which used to be interpolated into a
    // shell string. Allowlisted rather than trusted.
    const ALLOWED_FORMATS = ["mp4", "webm", "mkv", "mov", "avi"]
    if (format && !ALLOWED_FORMATS.includes(format.toLowerCase())) {
      return NextResponse.json({ error: "Unsupported output format." }, { status: 400 })
    }

    if (!format) {
      return NextResponse.json({ error: "Format is required" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const tempDir = tmpdir()
    const timestamp = Date.now()
    const originalExt = path.extname(file.name) || ".mp4"
    tempFile = path.join(tempDir, `convert_${timestamp}_input${originalExt}`)
    outputFile = path.join(tempDir, `convert_${timestamp}_output.${format}`)

    await writeFile(tempFile, buffer)

    // Arguments as an array: no shell, so these paths are never parsed.
    const { stdout, stderr } = await run(
      "ffmpeg",
      ["-i", tempFile, "-c:v", "libx264", "-c:a", "aac", "-preset", "medium", "-y", outputFile],
      { maxBuffer: 50 * 1024 * 1024, timeout: 300000 }
    )

    if (!existsSync(outputFile)) {
      throw new Error("Conversion failed - output file not found")
    }

    const convertedBuffer = await readFile(outputFile)

    if (tempFile && existsSync(tempFile)) {
      await unlink(tempFile)
    }
    if (outputFile && existsSync(outputFile)) {
      await unlink(outputFile)
    }

    const contentTypeMap: Record<string, string> = {
      mp4: "video/mp4",
      webm: "video/webm",
      mkv: "video/x-matroska",
      avi: "video/x-msvideo",
      mov: "video/quicktime",
      flv: "video/x-flv",
      wmv: "video/x-ms-wmv",
      m4v: "video/x-m4v",
    }

    const contentType = contentTypeMap[format.toLowerCase()] || "application/octet-stream"

    return new NextResponse(convertedBuffer as any, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="converted.${format}"`,
        "Content-Length": convertedBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error("Error converting video:", error)

    if (tempFile && existsSync(tempFile)) {
      try {
        await unlink(tempFile)
      } catch {}
    }
    if (outputFile && existsSync(outputFile)) {
      try {
        await unlink(outputFile)
      } catch {}
    }

    return NextResponse.json({ error: error.message || "Video conversion failed" }, { status: 500 })
  }
}

export const maxDuration = 300
