import { NextRequest, NextResponse } from "next/server"
import { run, parseHttpUrl } from "@/lib/shell/run"
import { findNewestFile } from "@/lib/media/temp-files"
import { readFile, unlink, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { tmpdir } from "os"

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

    const tempDir = path.join(tmpdir(), "song-downloads")
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true })
    }

    let songTitle = title || "song"
    let songArtist = artist || "Unknown"
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
      }

      const info = JSON.parse(infoStdout)
      if (info.title) songTitle = info.title
      if (info.artist || info.uploader || info.creator) {
        songArtist = info.artist || info.uploader || info.creator
      }
    } catch (err: any) {
      const errorMessage = err.stderr || err.message || ""
      if (errorMessage.includes("[DRM]") || errorMessage.includes("DRM protection")) {
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
      }
      console.log("Could not fetch song title, using provided/default")
    }

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

    const timestamp = Date.now()
    let outputTemplate = path.join(tempDir, `${sanitizedArtist}_${sanitizedTitle}_${timestamp}.%(ext)s`)

    // argv array, so nothing in the URL or the title-derived path is parsed.
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

    ytdlpArgs.push("-x", "--audio-format", "mp3", "--audio-quality", audioBitrate)
    outputTemplate = path.join(tempDir, `${sanitizedArtist}_${sanitizedTitle}_${timestamp}.mp3`)
    ytdlpArgs.push("-o", outputTemplate, "--no-warnings", target.toString())

    let stdout: string
    let stderr: string

    try {
      const result = await run("yt-dlp", ytdlpArgs, {
        maxBuffer: 50 * 1024 * 1024,
        timeout: 120000,
      })
      stdout = result.stdout
      stderr = result.stderr || ""
    } catch (execError: any) {
      const errorMessage = execError.stderr || execError.message || ""
      if (errorMessage.includes("[DRM]") || errorMessage.includes("DRM protection")) {
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
      }
      throw execError
    }

    console.log("Download stdout:", stdout)
    if (stderr) {
      if (stderr.includes("[DRM]") || stderr.includes("DRM protection")) {
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
      }
      console.log("Download stderr:", stderr)
    }

    await new Promise((resolve) => setTimeout(resolve, 500))

    tempFile =
      (await findNewestFile(tempDir, { contains: String(timestamp) })) ??
      (await findNewestFile(tempDir, { extensions: [".mp3"], withinMs: 2 * 60 * 1000 })) ??
      (await findNewestFile(tempDir, { extensions: [".mp3"] }))

    if (!tempFile || !existsSync(tempFile)) {
      let ffmpegInstalled = false
      try {
        await run("which", ["ffmpeg"])
        ffmpegInstalled = true
      } catch (e) {}

      if (!ffmpegInstalled) {
        throw new Error("ffmpeg is required for MP3 conversion.")
      }

      throw new Error("Download failed - file not found.")
    }

    const fileBuffer = await readFile(tempFile)

    const sanitizedFilename = `${sanitizedArtist}_${sanitizedTitle}.mp3`
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .substring(0, 200)

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
    console.error("Error downloading song:", error)

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

export const maxDuration = 120
