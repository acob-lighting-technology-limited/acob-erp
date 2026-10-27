/**
 * Add or remove a PDF password in the browser with qpdf compiled to
 * WebAssembly (the same qpdf a server would run). pdf-lib cannot encrypt or
 * decrypt, so this is the one tool that needs a separate engine.
 *
 * qpdf runs in public/workers/qpdf-worker.js, off the main thread and outside
 * the bundler (its Emscripten loader references Node built-ins). The engine
 * files are copied into public/vendor/pdf-engines by
 * scripts/copy-pdf-engines.mjs on install.
 */

/** qpdf exit codes: 0 success, 2 error, 3 success with warnings. */
const QPDF_ERROR = 2

/**
 * AES-256, with the same password as user and owner password: whoever has the
 * password can open, print and edit, which is what staff expect. The `=` form
 * keeps a password that starts with "-" from being read as an option.
 */
export const protectArgs = (password: string) => [
  "--encrypt",
  `--user-password=${password}`,
  `--owner-password=${password}`,
  "--bits=256",
  "--",
  "/in.pdf",
  "/out.pdf",
]

export const unlockArgs = (password: string) => ["--decrypt", `--password=${password}`, "/in.pdf", "/out.pdf"]

interface QpdfRun {
  code: number
  output: Uint8Array | null
}

function runQpdf(file: Blob, args: string[]): Promise<QpdfRun> {
  return new Promise((resolve, reject) => {
    const worker = new Worker("/workers/qpdf-worker.js")
    worker.onmessage = ({ data }: MessageEvent<QpdfRun & { error?: string }>) => {
      worker.terminate()
      if (data.error) reject(new Error(`The PDF engine failed: ${data.error}`))
      else resolve(data)
    }
    worker.onerror = () => {
      worker.terminate()
      reject(new Error("The PDF engine could not start. Reload the page and try again."))
    }
    worker.postMessage({ file, args })
  })
}

// No "is it encrypted?" pre-check: this build's --is-encrypted and
// --requires-password both fail with "invalid password" on a file that has an
// open password, so they cannot tell it apart from a plain one. qpdf's exit
// code on the real command is enough.

export async function protectPdf(file: Blob, password: string): Promise<Uint8Array> {
  const { code, output } = await runQpdf(file, protectArgs(password))
  if (code === QPDF_ERROR || !output) {
    throw new Error("This PDF could not be protected. If it already has a password, remove it first.")
  }
  return output
}

export async function unlockPdf(file: Blob, password: string): Promise<Uint8Array> {
  const { code, output } = await runQpdf(file, unlockArgs(password))
  if (code === QPDF_ERROR || !output) throw new Error("Wrong password, or the PDF is damaged.")
  return output
}
