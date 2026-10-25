import { NextRequest, NextResponse } from "next/server"
import { parseHttpUrl } from "@/lib/shell/run"
import { isSafeFormatSelector } from "@/lib/media/temp-files"
import { spawn } from "child_process"
import { Readable } from "stream"
import { logger } from "@/lib/logger"

const log = logger("api/public/download")

export const maxDuration = 300

function buildStreamHeaders(title: string | null, isAudio: boolean, size?: string | null) {
  const cleanTitle = (title || "download")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, "_")
    .substring(0, 150)
    .trim()
  const ext = isAudio ? ".mp3" : ".webm"
  const filename = `${cleanTitle}${ext}`
  const contentType = isAudio ? "audio/mpeg" : "video/webm"

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Accept-Ranges": "bytes",
  }

  if (size) {
    const parsed = parseInt(size, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      headers["Content-Length"] = parsed.toString()
    }
  }

  return headers
}

export async function HEAD(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")
  if (!url) return new Response(null, { status: 400 })

  const format_id = request.nextUrl.searchParams.get("format_id")
  const title = request.nextUrl.searchParams.get("title")
  const size = request.nextUrl.searchParams.get("size")
  const isAudio = format_id?.startsWith("audio_mp3_") ?? false

  return new Response(null, {
    status: 200,
    headers: buildStreamHeaders(title, isAudio, size),
  })
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url")
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    const target = parseHttpUrl(url)
    if (!target) {
      return NextResponse.json({ error: "Enter a valid http(s) link." }, { status: 400 })
    }

    const format_id = request.nextUrl.searchParams.get("format_id")
    const title = request.nextUrl.searchParams.get("title")
    const size = request.nextUrl.searchParams.get("size")
    const isAudio = format_id?.startsWith("audio_mp3_") ?? false

    const ytdlpArgs = ["--js-runtimes", "node"]

    if (isAudio) {
      ytdlpArgs.push("-f", "bestaudio")
    } else if (format_id && isSafeFormatSelector(format_id) && format_id !== "best") {
      ytdlpArgs.push("-f", `${format_id}+bestaudio/${format_id}`)
    } else {
      ytdlpArgs.push("-f", "bestvideo+bestaudio/best")
    }

    // Pipe directly to stdout for instant streaming
    ytdlpArgs.push("-o", "-", "--no-warnings", target.toString())

    const ytProcess = spawn("yt-dlp", ytdlpArgs, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    })

    request.signal.addEventListener("abort", () => {
      try {
        ytProcess.kill()
      } catch {}
    })

    ytProcess.stdout.on("close", () => {
      try {
        ytProcess.kill()
      } catch {}
    })

    ytProcess.stderr.on("data", (data) => {
      const msg = data.toString()
      if (msg.includes("ERROR:")) {
        log.error("yt-dlp streaming error:", msg)
      }
    })

    const webStream = Readable.toWeb(ytProcess.stdout) as ReadableStream<Uint8Array>

    return new Response(webStream, {
      status: 200,
      headers: buildStreamHeaders(title, isAudio, size),
    })
  } catch (error: any) {
    log.error("Failed to initiate media stream:", error)
    return NextResponse.json({ error: "Failed to initiate stream" }, { status: 500 })
  }
}
