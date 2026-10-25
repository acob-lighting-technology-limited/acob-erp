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

async function processDownload(params: { url: string | null; format_id?: string | null; title?: string | null }) {
  let tempFile: string | null = null

  const { url, format_id, title } = params

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 })
  }

  const target = parseHttpUrl(url)
  if (!target) {
    return NextResponse.json({ error: "Enter a valid http(s) link." }, { status: 400 })
  }

  // Create a temporary directory for downloads
  const tempDir = path.join(tmpdir(), "video-downloads")
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

  // Generate a unique filename using sanitized title
  const timestamp = Date.now()
  let outputTemplate = path.join(tempDir, `${sanitizedTitle}_${timestamp}.%(ext)s`)

  // Built as an argv array: no shell
  const ytdlpArgs: string[] = []
  let isAudio = false
  let audioBitrate = "0" // Default to best quality

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
    outputTemplate = path.join(tempDir, `${sanitizedTitle}_${timestamp}.%(ext)s`)
    ytdlpArgs.push("-x", "--audio-format", "mp3", "--audio-quality", audioBitrate)
  } else if (format_id && isSafeFormatSelector(format_id) && format_id !== "best") {
    // If format is a video stream, combine with best audio stream and merge to MP4
    ytdlpArgs.push("-f", `${format_id}+bestaudio/${format_id}`, "--merge-output-format", "mp4")
  } else {
    ytdlpArgs.push("-f", "bestvideo+bestaudio/best", "--merge-output-format", "mp4")
  }

  // Use 5 concurrent fragment connections for fast DASH/HLS downloading
  ytdlpArgs.push("-N", "5", "-o", outputTemplate, "--no-warnings", target.toString())

  await run("yt-dlp", ytdlpArgs, {
    maxBuffer: 50 * 1024 * 1024,
    timeout: 300000,
  })

  // Find the downloaded file
  await new Promise((resolve) => setTimeout(resolve, 500))

  tempFile =
    (await findNewestFile(tempDir, { contains: String(timestamp) })) ??
    (await findNewestFile(tempDir, {
      extensions: isAudio ? [".mp3"] : [".mp4", ".webm", ".mkv"],
      withinMs: 5 * 60 * 1000,
    })) ??
    (await findNewestFile(tempDir))

  if (!tempFile || !existsSync(tempFile)) {
    throw new Error("Download failed - file not found.")
  }

  const originalFilename = path.basename(tempFile)
  const ext = isAudio ? ".mp3" : path.extname(originalFilename) || ".mp4"
  const cleanTitle = videoTitle
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, "_")
    .substring(0, 150)
    .trim()
  const sanitizedFilename = `${cleanTitle || "download"}${ext}`

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
      log.error("Error cleaning up temp file:", err)
    }
  })

  // Fallback cleanup after 30 minutes in case stream was interrupted
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

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": isAudio ? "audio/mpeg" : "video/mp4",
      "Content-Disposition": `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodeURIComponent(sanitizedFilename)}`,
      "Content-Length": stat.size.toString(),
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    return await processDownload(body)
  } catch (error: any) {
    log.error("Error downloading video:", error)
    return serverError(log, error, "Download failed")
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const url = searchParams.get("url")
    const format_id = searchParams.get("format_id")
    const title = searchParams.get("title")
    return await processDownload({ url, format_id, title })
  } catch (error: any) {
    log.error("Error downloading video:", error)
    return serverError(log, error, "Download failed")
  }
}
