import { NextRequest, NextResponse } from "next/server"
import { run, parseHttpUrl } from "@/lib/shell/run"
import { findNewestFile, isSafeFormatSelector } from "@/lib/media/temp-files"
import { readFile, unlink, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { tmpdir } from "os"

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

    // Create a temporary directory for downloads
    const tempDir = path.join(tmpdir(), "video-downloads")
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true })
    }

    // Get video info first to get proper title
    let videoTitle = title || "video"
    try {
      const { stdout: infoStdout } = await run("yt-dlp", ["-J", "--no-warnings", target.toString()], {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
      })
      const info = JSON.parse(infoStdout)
      if (info.title) {
        videoTitle = info.title
      }
    } catch (err) {
      console.log("Could not fetch video title, using default")
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

    // Built as an argv array: no shell, so neither the URL nor the format
    // selector nor the title-derived output path is ever parsed as syntax.
    const ytdlpArgs: string[] = []
    let isAudio = false
    let audioBitrate = "0" // Default to best quality
    let sanitizedTitleForAudio = sanitizedTitle // Default to same as video

    // Check if this is an MP3 audio conversion request
    if (format_id && format_id.startsWith("audio_mp3_")) {
      isAudio = true
      // Extract bitrate from format_id (e.g., audio_mp3_128 -> 128)
      const bitrateMatch = format_id.match(/audio_mp3_(\d+)/)
      if (bitrateMatch) {
        const bitrate = parseInt(bitrateMatch[1])
        if (bitrate >= 320) audioBitrate = "0"
        else if (bitrate >= 256) audioBitrate = "2"
        else if (bitrate >= 192) audioBitrate = "5"
        else audioBitrate = "9"
      }
      sanitizedTitleForAudio = videoTitle
        .replace(/[<>:"/\\|?*]/g, "_")
        .replace(/\s+/g, "_")
        .substring(0, 100)
        .trim()
      outputTemplate = path.join(tempDir, `${sanitizedTitleForAudio}_${timestamp}.%(ext)s`)
      ytdlpArgs.push("-x", "--audio-format", "mp3", "--audio-quality", audioBitrate)
    } else if (isSafeFormatSelector(format_id)) {
      ytdlpArgs.push("-f", format_id)
    } else {
      ytdlpArgs.push("-f", "best")
    }

    ytdlpArgs.push("-o", outputTemplate, "--no-warnings", target.toString())

    await run("yt-dlp", ytdlpArgs, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 120000,
    })

    // Find the downloaded file. yt-dlp picks the final extension itself, so
    // the name is not known ahead of time — narrow by the timestamp stamped
    // into the output template, then by the expected media extensions.
    await new Promise((resolve) => setTimeout(resolve, 500))

    tempFile =
      (await findNewestFile(tempDir, { contains: String(timestamp) })) ??
      (await findNewestFile(tempDir, {
        extensions: isAudio ? [".mp3"] : [".mp4", ".webm", ".mkv"],
        withinMs: 2 * 60 * 1000,
      })) ??
      (await findNewestFile(tempDir))

    if (!tempFile || !existsSync(tempFile)) {
      let ffmpegInstalled = false
      try {
        await run("which", ["ffmpeg"])
        ffmpegInstalled = true
      } catch (e) {}

      if (isAudio && !ffmpegInstalled) {
        throw new Error("ffmpeg is required for MP3 conversion.")
      }

      throw new Error("Download failed - file not found.")
    }

    // Read the file
    const fileBuffer = await readFile(tempFile)
    const originalFilename = path.basename(tempFile)

    let sanitizedFilename = originalFilename

    if (videoTitle && videoTitle !== "video") {
      const ext = isAudio ? ".mp3" : path.extname(originalFilename) || ".mp4"
      const cleanTitle = videoTitle
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
        .replace(/\s+/g, "_")
        .substring(0, 150)
        .trim()
      sanitizedFilename = `${cleanTitle}${ext}`
    } else {
      sanitizedFilename = originalFilename.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").substring(0, 200)
    }

    // Clean up temp file
    setTimeout(async () => {
      try {
        if (tempFile && existsSync(tempFile)) {
          await unlink(tempFile)
        }
      } catch (err) {
        console.error("Error cleaning up temp file:", err)
      }
    }, 1000)

    return new NextResponse(fileBuffer as any, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodeURIComponent(sanitizedFilename)}`,
        "Content-Length": fileBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error("Error downloading video:", error)

    if (tempFile && existsSync(tempFile)) {
      try {
        await unlink(tempFile)
      } catch (err) {
        console.error("Error cleaning up temp file:", err)
      }
    }

    return NextResponse.json({ error: error.message || "Download failed" }, { status: 500 })
  }
}

export const maxDuration = 60
