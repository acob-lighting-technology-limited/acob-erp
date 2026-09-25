import { NextRequest, NextResponse } from "next/server"
import { run, parseHttpUrl } from "@/lib/shell/run"
import { isSafeFormatSelector } from "@/lib/media/temp-files"
import { readFile, unlink, mkdir, readdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { tmpdir } from "os"
import JSZip from "jszip"

export async function POST(request: NextRequest) {
  const tempDir = path.join(tmpdir(), "batch-downloads")
  const batchId = `batch_${Date.now()}`
  const batchDir = path.join(tempDir, batchId)
  const files: string[] = []

  try {
    const body = await request.json()
    const { urls, format_id } = body

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "URLs array is required" }, { status: 400 })
    }

    const validUrls = urls
      .map((url: string) => url.trim())
      .filter((url: string) => {
        if (!url) return false
        try {
          new URL(url)
          return true
        } catch {
          return false
        }
      })

    if (validUrls.length === 0) {
      return NextResponse.json({ error: "No valid URLs provided" }, { status: 400 })
    }

    if (!existsSync(batchDir)) {
      await mkdir(batchDir, { recursive: true })
    }

    // Download each video
    for (let i = 0; i < validUrls.length; i++) {
      const url = validUrls[i]
      const outputTemplate = path.join(batchDir, `video_${i + 1}.%(ext)s`)

      const target = parseHttpUrl(url)
      if (!target) continue

      try {
        // argv array, so neither the URL nor the format selector is parsed.
        await run(
          "yt-dlp",
          [
            "-f",
            isSafeFormatSelector(format_id) ? format_id : "best",
            "-o",
            outputTemplate,
            "--no-warnings",
            target.toString(),
          ],
          { maxBuffer: 50 * 1024 * 1024, timeout: 120000 }
        )

        // Find the downloaded file
        const dirFiles = await readdir(batchDir)
        const downloadedFile = dirFiles.find((f) => f.startsWith(`video_${i + 1}.`))
        if (downloadedFile) {
          files.push(path.join(batchDir, downloadedFile))
        }
      } catch (error: any) {
        console.error(`Error downloading ${url}:`, error)
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No files were downloaded successfully" }, { status: 500 })
    }

    // Create a zip file using jszip
    const zip = new JSZip()
    for (const file of files) {
      if (existsSync(file)) {
        const fileContent = await readFile(file)
        zip.file(path.basename(file), fileContent)
      }
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })

    // Clean up files
    setTimeout(async () => {
      try {
        for (const file of files) {
          if (existsSync(file)) {
            await unlink(file)
          }
        }
        if (existsSync(batchDir)) {
          const dirFiles = await readdir(batchDir)
          for (const file of dirFiles) {
            await unlink(path.join(batchDir, file))
          }
          await require("fs").promises.rmdir(batchDir)
        }
      } catch (err) {
        console.error("Error cleaning up batch files:", err)
      }
    }, 1000)

    return new NextResponse(zipBuffer as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="batch_download_${batchId}.zip"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error("Error in batch download:", error)

    try {
      if (existsSync(batchDir)) {
        const dirFiles = await readdir(batchDir)
        for (const file of dirFiles) {
          await unlink(path.join(batchDir, file))
        }
        await require("fs").promises.rmdir(batchDir)
      }
    } catch (err) {
      console.error("Error cleaning up on error:", err)
    }

    return NextResponse.json({ error: error.message || "Batch download failed" }, { status: 500 })
  }
}

export const maxDuration = 300
