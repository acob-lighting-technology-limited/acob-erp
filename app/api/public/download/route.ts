import { NextRequest, NextResponse } from "next/server"
import { findNewestFile } from "@/lib/media/temp-files"
import { existsSync, createReadStream, statSync } from "fs"
import { Readable } from "stream"
import path from "path"
import { tmpdir } from "os"

export const maxDuration = 300

const videoTempDir = path.join(tmpdir(), "video-downloads")
const songTempDir = path.join(tmpdir(), "song-downloads")

async function resolvePreparedFile(fileId: string): Promise<string | null> {
  if (!fileId || !/^[a-zA-Z0-9-]{10,64}$/.test(fileId)) {
    return null
  }

  let tempFile = await findNewestFile(videoTempDir, { contains: fileId })
  if (!tempFile || !existsSync(tempFile)) {
    tempFile = await findNewestFile(songTempDir, { contains: fileId })
  }

  return tempFile && existsSync(tempFile) ? tempFile : null
}

export async function HEAD(request: NextRequest) {
  try {
    const fileId = request.nextUrl.searchParams.get("id")
    if (!fileId) return new Response(null, { status: 400 })

    const tempFile = await resolvePreparedFile(fileId)
    if (!tempFile) return new Response(null, { status: 404 })

    const rawName = request.nextUrl.searchParams.get("name") || path.basename(tempFile)
    const sanitizedFilename = rawName.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").substring(0, 150)
    const isAudio = sanitizedFilename.endsWith(".mp3")
    const stat = statSync(tempFile)

    return new Response(null, {
      status: 200,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": stat.size.toString(),
        "Content-Type": isAudio ? "audio/mpeg" : "video/mp4",
        "Content-Disposition": `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodeURIComponent(sanitizedFilename)}`,
      },
    })
  } catch {
    return new Response(null, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const fileId = request.nextUrl.searchParams.get("id")
    if (!fileId) {
      return NextResponse.json({ error: "Invalid file ID" }, { status: 400 })
    }

    const tempFile = await resolvePreparedFile(fileId)
    if (!tempFile) {
      return NextResponse.json({ error: "File not found or expired" }, { status: 404 })
    }

    const rawName = request.nextUrl.searchParams.get("name") || path.basename(tempFile)
    const sanitizedFilename = rawName.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").substring(0, 150)
    const isAudio = sanitizedFilename.endsWith(".mp3")
    const contentType = isAudio ? "audio/mpeg" : "video/mp4"

    const stat = statSync(tempFile)
    const fileSize = stat.size

    // Handle HTTP Range requests for download accelerators like NDM and IDM
    const rangeHeader = request.headers.get("range")
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-")
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

      if (start >= fileSize || end >= fileSize || start > end) {
        return new Response(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${fileSize}`,
          },
        })
      }

      const chunkSize = end - start + 1
      const nodeStream = createReadStream(tempFile, { start, end })
      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>

      return new Response(webStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodeURIComponent(sanitizedFilename)}`,
        },
      })
    }

    const nodeStream = createReadStream(tempFile)
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>

    return new Response(webStream, {
      status: 200,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": fileSize.toString(),
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodeURIComponent(sanitizedFilename)}`,
      },
    })
  } catch {
    return NextResponse.json({ error: "Failed to deliver file" }, { status: 500 })
  }
}
