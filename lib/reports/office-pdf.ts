import { randomUUID } from "crypto"
import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { logger } from "@/lib/logger"

const log = logger("office-pdf")
const CONVERTER_SCRIPT = join(process.cwd(), "scripts", "office", "convert-to-pdf.ps1")

type ConvertibleOfficeKind = "docx" | "pptx"

export type ConvertedOfficeDocument = {
  buffer: Uint8Array
  fileName: string
  mimeType: "application/pdf"
  fileSize: number
  sourceKind: ConvertibleOfficeKind
}

function runPowerShellConversion(inputPath: string, outputPath: string, kind: ConvertibleOfficeKind) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        CONVERTER_SCRIPT,
        "-InputPath",
        inputPath,
        "-OutputPath",
        outputPath,
        "-Kind",
        kind,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    )

    let stderr = ""
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })

    child.on("error", (error) => {
      reject(error)
    })

    child.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(stderr.trim() || `PowerShell conversion failed with exit code ${code}`))
    })
  })
}

export async function convertOfficeDocumentToPdf(
  input: Uint8Array,
  baseName: string,
  kind: ConvertibleOfficeKind
): Promise<ConvertedOfficeDocument> {
  const workDir = await mkdtemp(join(tmpdir(), "acob-office-convert-"))
  const sourcePath = join(workDir, `${randomUUID()}.${kind}`)
  const pdfPath = join(workDir, `${randomUUID()}.pdf`)

  try {
    await writeFile(sourcePath, input)
    await runPowerShellConversion(sourcePath, pdfPath, kind)

    const [buffer, pdfStats] = await Promise.all([readFile(pdfPath), stat(pdfPath)])

    return {
      buffer,
      fileName: `${baseName}.pdf`,
      mimeType: "application/pdf",
      fileSize: pdfStats.size,
      sourceKind: kind,
    }
  } catch (error) {
    log.error({ err: String(error), kind }, "Failed to convert office document to PDF")
    throw new Error("We couldn't convert this file to PDF on the server. Please try again or upload a PDF instead.")
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
