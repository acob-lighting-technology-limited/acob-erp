import { NextRequest, NextResponse } from "next/server"
import { run, parseHttpUrl } from "@/lib/shell/run"
import { findNewestFile, isSafeFormatSelector } from "@/lib/media/temp-files"
import { unlink, mkdir } from "fs/promises"
import { existsSync, createReadStream, statSync } from "fs"
import { Readable } from "stream"
import path from "path"
import { tmpdir } from "os"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/download")

export const maxDuration = 300

const tempDir = path.join(tmpdir(), "video-downloads")

export async function POST(request: NextRequest) {
  let tempFile: string | null = null

  try {
    const body = await request.json()
    const { url, format_id, title } = body

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    const target = parseHttpUrl(url)
    if (!target) {
      return NextResponse.json({ error: "Enter a valid http(s) link." }, { status: 400 })
    }

    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true })
    }

    // Get video info first only if title was not passed from the client
    let videoTitle = title || ""
    if (!videoTitle) {
      try {
        const { stdout: infoStdout } = await run("yt-dlp", ["-J", "--no-warnings", target.toString()], {
          maxBuffer: 10 * 1024 * 1024,
          timeout: 30000,
        })
        const info = JSON.parse(infoStdout)
        if (info.title) {
          videoTitle = info.title
        }
      } catch {
        log.info("Could not fetch video title, using default")
      }
    }

    if (!videoTitle) {
      videoTitle = "video"
    }

    // Sanitize title for filename
    const sanitizedTitle = videoTitle
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, "_")
      .substring(0, 100)
      .trim()

    const fileId = globalThis.crypto.randomUUID()
    const timestamp = Date.now()
    let outputTemplate = path.join(tempDir, `${fileId}_${timestamp}.%(ext)s`)

    const ytdlpArgs: string[] = []
    let isAudio = false
    let audioBitrate = "0"

    // Check if this is an MP3 audio conversion request
    if (format_id && format_id.startsWith("audio_mp3_")) {
      isAudio = true
      const bitrateMatch = format_id.match(/audio_mp3_(\d+)/)
      if (bitrateMatch) {
        const bitrate = parseInt(bitrateMatch[1])
        if (bitrate >= 320) audioBitrate = "0"
        else if (bitrate >= 256) audioBitrate = "2"
        else if (bitrate >= 192) audioBitrate = "5"
        else audioBitrate = "9"
      }
      outputTemplate = path.join(tempDir, `${fileId}_${timestamp}.%(ext)s`)
      ytdlpArgs.push("-x", "--audio-format", "mp3", "--audio-quality", audioBitrate)
    } else if (format_id && isSafeFormatSelector(format_id) && format_id !== "best") {
      // If format is a video stream, combine with best audio stream and merge to MP4
      ytdlpArgs.push("-f", `${format_id}+bestaudio/${format_id}`, "--merge-output-format", "mp4")
    } else {
      ytdlpArgs.push("-f", "bestvideo+bestaudio/best", "--merge-output-format", "mp4")
    }

    // Use 5 concurrent fragment connections for fast multi-threaded downloading
    ytdlpArgs.push("-N", "5", "-o", outputTemplate, "--no-warnings", target.toString())

    await run("yt-dlp", ytdlpArgs, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 300000,
    })

    await new Promise((resolve) => setTimeout(resolve, 500))

    tempFile =
      (await findNewestFile(tempDir, { contains: fileId })) ??
      (await findNewestFile(tempDir, { contains: String(timestamp) }))

    if (!tempFile || !existsSync(tempFile)) {
      throw new Error("Download failed - file not found.")
    }

    const originalFilename = path.basename(tempFile)
    const ext = isAudio ? ".mp3" : path.extname(originalFilename) || ".mp4"
    const cleanTitle = sanitizedTitle || "video"
    const sanitizedFilename = `${cleanTitle}${ext}`

    const stat = statSync(tempFile)

    // Safety fallback cleanup after 30 minutes if client never downloads
    const fileToClean = tempFile
    setTimeout(
      async () => {
        try {
          if (existsSync(fileToClean)) {
            await unlink(fileToClean)
          }
        } catch {}
      },
      30 * 60 * 1000
    )

    return NextResponse.json({
      success: true,
      fileId,
      filename: sanitizedFilename,
      size: stat.size,
    })
  } catch (error: any) {
    log.error("Error downloading video:", error)
    if (tempFile && existsSync(tempFile)) {
      try {
        await unlink(tempFile)
      } catch (err) {
        log.error("Error cleaning up temp file:", err)
      }
    }
    return serverError(log, error, "Download failed")
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const fileId = searchParams.get("id")

    if (!fileId || !/^[a-zA-Z0-9-]{10,64}$/.test(fileId)) {
      return NextResponse.json({ error: "Invalid file ID" }, { status: 400 })
    }

    const tempFile = await findNewestFile(tempDir, { contains: fileId })
    if (!tempFile || !existsSync(tempFile)) {
      return NextResponse.json({ error: "File not found or expired" }, { status: 404 })
    }

    const rawName = searchParams.get("name") || path.basename(tempFile)
    const sanitizedFilename = rawName.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").substring(0, 150)
    const isAudio = sanitizedFilename.endsWith(".mp3")

    const stat = statSync(tempFile)
    const nodeStream = createReadStream(tempFile)
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>

    const fileToClean = tempFile
    nodeStream.on("close", async () => {
      try {
        if (existsSync(fileToClean)) {
          await unlink(fileToClean)
        }
      } catch (err) {
        log.error("Error cleaning up temp file on close:", err)
      }
    })

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": isAudio ? "audio/mpeg" : "video/mp4",
        "Content-Disposition": `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodeURIComponent(sanitizedFilename)}`,
        "Content-Length": stat.size.toString(),
      },
    })
  } catch (error: any) {
    log.error("Error serving downloaded file:", error)
    return serverError(log, error, "Failed to deliver file")
  }
}
