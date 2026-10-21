import { NextRequest, NextResponse } from "next/server"
import { parseJsonBody } from "@/lib/api/parse-body"
import { z } from "zod"
import { run, parseHttpUrl } from "@/lib/shell/run"
import { findNewestFile } from "@/lib/media/temp-files"
import { readFile, unlink, mkdir, readdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { tmpdir } from "os"
import JSZip from "jszip"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/song/batch-download")

// Each URL runs a yt-dlp process for up to two minutes, so a batch is capped.
const MAX_BATCH_URLS = 20

export async function POST(request: NextRequest) {
  const tempDir = path.join(tmpdir(), "song-batch-downloads")
  const batchId = `batch_${Date.now()}`
  const batchDir = path.join(tempDir, batchId)
  const files: string[] = []

  try {
    const parsed = await parseJsonBody(
      request,
      z.object({
        urls: z
          .array(z.string().max(2000))
          .min(1, "URLs array is required")
          .max(MAX_BATCH_URLS, `At most ${MAX_BATCH_URLS} links per batch`),
        playlistName: z.string().max(200).optional(),
      })
    )
    if (!parsed.ok) return parsed.response
    const { urls, playlistName } = parsed.data

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

    // Download each song
    for (let i = 0; i < validUrls.length; i++) {
      const url = validUrls[i]
      const outputTemplate = path.join(batchDir, `song_${i + 1}.%(ext)s`)

      const target = parseHttpUrl(url)
      if (!target) continue

      try {
        // argv array, so the URL is never parsed as shell syntax.
        await run(
          "yt-dlp",
          [
            "-x",
            "--audio-format",
            "mp3",
            "--audio-quality",
            "0",
            "-o",
            outputTemplate,
            "--no-warnings",
            target.toString(),
          ],
          { maxBuffer: 50 * 1024 * 1024, timeout: 120000 }
        )

        await new Promise((resolve) => setTimeout(resolve, 500))
        const dirFiles = await readdir(batchDir)
        const downloadedFile = dirFiles.find((f) => f.startsWith(`song_${i + 1}.`) && f.endsWith(".mp3"))
        if (downloadedFile) {
          files.push(path.join(batchDir, downloadedFile))
        } else {
          const foundFile = await findNewestFile(batchDir, { extensions: [".mp3"], withinMs: 2 * 60 * 1000 })
          if (foundFile && !files.includes(foundFile)) {
            files.push(foundFile)
          }
        }
      } catch (error: any) {
        log.error(`Error downloading ${url}:`, error)
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
        log.error("Error cleaning up batch files:", err)
      }
    }, 1000)

    const zipFilename = playlistName
      ? `${playlistName.replace(/[^a-zA-Z0-9]/g, "_")}_${batchId}.zip`
      : `songs_${batchId}.zip`

    return new NextResponse(zipBuffer as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    log.error("Error in batch song download:", error)

    try {
      if (existsSync(batchDir)) {
        const dirFiles = await readdir(batchDir)
        for (const file of dirFiles) {
          await unlink(path.join(batchDir, file))
        }
        await require("fs").promises.rmdir(batchDir)
      }
    } catch (err) {
      log.error("Error cleaning up on error:", err)
    }

    return serverError(log, error, "Batch download failed")
  }
}

// Vercel rejects the build outright if this exceeds the plan's ceiling (300s),
// so the whole app fails to deploy, not just this route.
export const maxDuration = 300
