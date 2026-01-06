import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"
import type { WatermarkConfig } from "@/components/watermark-studio"

let ffmpeg: FFmpeg | null = null

async function loadFFmpeg() {
  if (ffmpeg) return ffmpeg

  ffmpeg = new FFmpeg()

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd"
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  })

  return ffmpeg
}

export async function processVideo(videoFile: File, watermarkPath: string, config: WatermarkConfig): Promise<string> {
  const ffmpeg = await loadFFmpeg()

  // Write input files
  await ffmpeg.writeFile("input.mp4", await fetchFile(videoFile))
  // Preserve original extension for watermark to support webp/png/jpg, etc.
  const watermarkUrl = new URL(watermarkPath, window.location.origin)
  const watermarkExt = (watermarkUrl.pathname.split(".").pop() || "png").toLowerCase()
  const watermarkFileName = `watermark.${watermarkExt}`
  await ffmpeg.writeFile(watermarkFileName, await fetchFile(watermarkPath))

  // Calculate position based on config
  const positionMap = {
    "top-left": "x=10:y=10",
    "top-center": "x=(main_w-overlay_w)/2:y=10",
    "top-right": "x=main_w-overlay_w-10:y=10",
    "middle-left": "x=10:y=(main_h-overlay_h)/2",
    center: "x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2",
    "center-down-10": "x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2+main_h*0.1",
    "center-down-20": "x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2+main_h*0.2",
    "center-down-25": "x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2+main_h*0.25",
    "middle-right": "x=main_w-overlay_w-10:y=(main_h-overlay_h)/2",
    "bottom-left": "x=10:y=main_h-overlay_h-10",
    "bottom-center": "x=(main_w-overlay_w)/2:y=main_h-overlay_h-10",
    "bottom-right": "x=main_w-overlay_w-10:y=main_h-overlay_h-10",
  }

  const position = positionMap[config.position]
  const scale = `scale=iw*${config.size / 100}:-1`
  const opacity = `format=rgba,colorchannelmixer=aa=${config.opacity}`

  // Apply watermark with FFmpeg
  await ffmpeg.exec([
    "-i",
    "input.mp4",
    "-i",
    watermarkFileName,
    "-filter_complex",
    `[1:v]${scale},${opacity}[wm];[0:v][wm]overlay=${position}`,
    "-codec:a",
    "copy",
    "output.mp4",
  ])

  // Read output file
  const data = (await ffmpeg.readFile("output.mp4")) as Uint8Array
  // Copy into a fresh Uint8Array to avoid SharedArrayBuffer issues
  const bytes = new Uint8Array(data.length)
  bytes.set(data)
  const blob = new Blob([bytes], { type: "video/mp4" })
  return URL.createObjectURL(blob)
}
