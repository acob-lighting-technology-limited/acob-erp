import { NextRequest, NextResponse } from "next/server"
import { run, parseHttpUrl } from "@/lib/shell/run"
import { findNewestFile } from "@/lib/media/temp-files"
import { unlink, mkdir } from "fs/promises"
import { existsSync, createReadStream, statSync } from "fs"
import { Readable } from "stream"
import path from "path"
import { tmpdir } from "os"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/song/download")

export const maxDuration = 300

const tempDir = path.join(tmpdir(), "song-downloads")

const DRM_PROTECTED_PLATFORMS = [
  "spotify.com",
  "open.spotify.com",
  "music.apple.com",
  "itunes.apple.com",
  "music.amazon.com",
  "pandora.com",
  "tidal.com",
  "qobuz.com",
]

function isDRMProtected(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const domain = urlObj.hostname.toLowerCase().replace("www.", "")
    return DRM_PROTECTED_PLATFORMS.some((platform) => domain.includes(platform))
  } catch {
    return false
  }
}

function getDRMResponse(url: string) {
  try {
    const urlObj = new URL(url)
    const domain = urlObj.hostname.toLowerCase().replace("www.", "")
    let platformName = "This platform"
    if (domain.includes("spotify")) platformName = "Spotify"
    else if (domain.includes("apple") || domain.includes("itunes")) platformName = "Apple Music"
    else if (domain.includes("amazon")) platformName = "Amazon Music"
    else if (domain.includes("pandora")) platformName = "Pandora"
    else if (domain.includes("tidal")) platformName = "Tidal"
    else if (domain.includes("qobuz")) platformName = "Qobuz"

    return NextResponse.json(
      {
        error: `${platformName} uses DRM (Digital Rights Management) protection and cannot be downloaded.`,
        drmProtected: true,
        platform: platformName,
        suggestions: [
          "Try YouTube Music, SoundCloud, or Bandcamp instead",
          "Use the official platform app for offline listening",
          "Look for official download options in the platform's premium features",
        ],
      },
      { status: 400 }
    )
  } catch {
    return NextResponse.json(
      {
        error: "This platform uses DRM protection and cannot be downloaded.",
        drmProtected: true,
      },
      { status: 400 }
    )
  }
}

export async function POST(request: NextRequest) {
  let tempFile: string | null = null

  try {
    const body = await request.json()
    const { url, format_id, title, artist } = body

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    const target = parseHttpUrl(url)
    if (!target) {
      return NextResponse.json({ error: "Enter a valid http(s) link." }, { status: 400 })
    }

    if (isDRMProtected(url)) {
      return getDRMResponse(url)
    }

    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true })
    }

    let songTitle = title || ""
    let songArtist = artist || ""

    if (!songTitle || !songArtist) {
      try {
        const { stdout: infoStdout, stderr: infoStderr } = await run(
          "yt-dlp",
          ["-J", "--no-warnings", target.toString()],
          {
            maxBuffer: 10 * 1024 * 1024,
            timeout: 30000,
          }
        )

        if (infoStderr && (infoStderr.includes("[DRM]") || infoStderr.includes("DRM protection"))) {
          return getDRMResponse(url)
        }

        const info = JSON.parse(infoStdout)
        if (info.title && !songTitle) songTitle = info.title
        if ((info.artist || info.uploader || info.creator) && !songArtist) {
          songArtist = info.artist || info.uploader || info.creator
        }
      } catch (err: any) {
        const errorMessage = err.stderr || err.message || ""
        if (errorMessage.includes("[DRM]") || errorMessage.includes("DRM protection")) {
          return getDRMResponse(url)
        }
        log.info("Could not fetch song metadata, using provided/default")
      }
    }

    if (!songTitle) songTitle = "song"
    if (!songArtist) songArtist = "Unknown"

    const sanitizedTitle = songTitle
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, "_")
      .substring(0, 100)
      .trim()

    const sanitizedArtist = songArtist
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, "_")
      .substring(0, 50)
      .trim()

    const fileId = globalThis.crypto.randomUUID()
    const timestamp = Date.now()
    const outputTemplate = path.join(tempDir, `${fileId}_${timestamp}.%(ext)s`)

    const ytdlpArgs: string[] = []
    let audioBitrate = "0" // Default to best quality

    if (format_id && format_id.startsWith("audio_mp3_")) {
      const bitrateMatch = format_id.match(/audio_mp3_(\d+)/)
      if (bitrateMatch) {
        const bitrate = parseInt(bitrateMatch[1])
        if (bitrate >= 320) audioBitrate = "0"
        else if (bitrate >= 256) audioBitrate = "2"
        else if (bitrate >= 192) audioBitrate = "5"
        else audioBitrate = "9"
      }
    }

    ytdlpArgs.push(
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      audioBitrate,
      "-N",
      "5",
      "-o",
      outputTemplate,
      "--no-warnings",
      target.toString()
    )

    try {
      await run("yt-dlp", ytdlpArgs, {
        maxBuffer: 50 * 1024 * 1024,
        timeout: 300000,
      })
    } catch (execError: any) {
      const errorMessage = execError.stderr || execError.message || ""
      if (errorMessage.includes("[DRM]") || errorMessage.includes("DRM protection")) {
        return getDRMResponse(url)
      }
      throw execError
    }

    await new Promise((resolve) => setTimeout(resolve, 500))

    tempFile =
      (await findNewestFile(tempDir, { contains: fileId })) ??
      (await findNewestFile(tempDir, { extensions: [".mp3"], withinMs: 5 * 60 * 1000 }))

    if (!tempFile || !existsSync(tempFile)) {
      throw new Error("Download failed - file not found.")
    }

    const sanitizedFilename = `${sanitizedArtist}_${sanitizedTitle}.mp3`
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .substring(0, 200)

    const stat = statSync(tempFile)

    // Safety fallback cleanup after 30 minutes
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
    log.error("Error downloading song:", error)
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
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodeURIComponent(sanitizedFilename)}`,
        "Content-Length": stat.size.toString(),
      },
    })
  } catch (error: any) {
    log.error("Error serving downloaded song:", error)
    return serverError(log, error, "Failed to deliver file")
  }
}
