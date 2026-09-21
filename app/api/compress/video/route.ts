import { NextRequest, NextResponse } from "next/server"
import { run } from "@/lib/shell/run"
import { readFile, unlink, writeFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { tmpdir } from "os"
import { logger } from "@/lib/logger"

const log = logger("compress-video")

export async function POST(request: NextRequest) {
  let tempFile: string | null = null
  let outputFile: string | null = null

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const mode = formData.get("mode") as string
    const targetSize = formData.get("targetSize") as string
    const sizeUnit = formData.get("sizeUnit") as string
    const percentage = formData.get("percentage") as string

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const originalSize = buffer.length

    const tempDir = tmpdir()
    const timestamp = Date.now()
    // Comes from the uploaded filename, so constrain it rather than trusting it.
    const rawExt = path.extname(file.name).toLowerCase()
    const originalExt = /^\.[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : ".mp4"
    tempFile = path.join(tempDir, `compress_${timestamp}_input${originalExt}`)
    outputFile = path.join(tempDir, `compress_${timestamp}_output.mp4`)

    await writeFile(tempFile, buffer)

    let targetSizeBytes: number | null = null
    let crf = 23

    if (mode === "size" && targetSize && sizeUnit) {
      const sizeValue = parseFloat(targetSize)
      if (isNaN(sizeValue) || sizeValue <= 0) {
        return NextResponse.json({ error: "Invalid target size" }, { status: 400 })
      }

      switch (sizeUnit.toUpperCase()) {
        case "KB":
          targetSizeBytes = sizeValue * 1024
          break
        case "MB":
          targetSizeBytes = sizeValue * 1024 * 1024
          break
        case "GB":
          targetSizeBytes = sizeValue * 1024 * 1024 * 1024
          break
        default:
          return NextResponse.json({ error: "Invalid size unit" }, { status: 400 })
      }

      if (targetSizeBytes >= originalSize) {
        return NextResponse.json({ error: "Target size must be smaller than original file size" }, { status: 400 })
      }

      const sizeRatio = targetSizeBytes / originalSize
      crf = Math.max(18, Math.min(28, 23 + (1 - sizeRatio) * 10))
    } else if (mode === "percentage" && percentage) {
      const percentValue = parseFloat(percentage)
      if (isNaN(percentValue) || percentValue <= 0 || percentValue >= 100) {
        return NextResponse.json({ error: "Percentage must be between 0 and 100" }, { status: 400 })
      }

      targetSizeBytes = originalSize * (1 - percentValue / 100)
      crf = Math.max(18, Math.min(28, 18 + (percentValue / 100) * 10))
    } else {
      return NextResponse.json({ error: "Invalid compression mode or parameters" }, { status: 400 })
    }

    // Arguments as an array: no shell, so nothing in these paths is parsed.
    const singlePassArgs = [
      "-i",
      tempFile,
      "-c:v",
      "libx264",
      "-crf",
      String(crf),
      "-preset",
      "medium",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-y",
      outputFile,
    ]

    if (targetSizeBytes) {
      const bitrate = Math.max(100, Math.floor((targetSizeBytes * 8) / 60))
      const nullOutput = process.platform === "win32" ? "NUL" : "/dev/null"
      const passBase = ["-i", tempFile, "-c:v", "libx264", "-b:v", `${bitrate}k`]

      try {
        // The old form redirected stderr into a log file that was deleted
        // without ever being read; execFile returns it instead.
        await run("ffmpeg", [...passBase, "-pass", "1", "-an", "-f", "null", nullOutput], {
          maxBuffer: 50 * 1024 * 1024,
          timeout: 300000,
        })

        await run("ffmpeg", [...passBase, "-pass", "2", "-c:a", "aac", "-b:a", "128k", "-y", outputFile], {
          maxBuffer: 50 * 1024 * 1024,
          timeout: 300000,
        })
      } catch (passError: any) {
        log.warn({ err: passError?.message }, "Two-pass encoding failed, falling back to single-pass")
        await run("ffmpeg", singlePassArgs, {
          maxBuffer: 50 * 1024 * 1024,
          timeout: 300000,
        })
      }
    } else {
      await run("ffmpeg", singlePassArgs, {
        maxBuffer: 50 * 1024 * 1024,
        timeout: 300000,
      })
    }

    if (!existsSync(outputFile)) {
      throw new Error("Compression failed - output file not found")
    }

    const compressedBuffer = await readFile(outputFile)

    if (tempFile && existsSync(tempFile)) {
      await unlink(tempFile)
    }
    if (outputFile && existsSync(outputFile)) {
      await unlink(outputFile)
    }

    return new NextResponse(compressedBuffer as any, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="compressed_${file.name}"`,
        "Content-Length": compressedBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error("Error compressing video:", error)

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

    return NextResponse.json({ error: error.message || "Video compression failed" }, { status: 500 })
  }
}

export const maxDuration = 300
