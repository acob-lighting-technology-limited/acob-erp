/* global importScripts, Module */
/**
 * Runs one qpdf command (WebAssembly) off the main thread; see lib/pdf/password.ts.
 * Message in: { file: Blob, args: string[] } — the file is written to /in.pdf.
 * Message out: { code, output } with /out.pdf when qpdf wrote one, or { error }.
 *
 * A fresh qpdf instance per command: once an Emscripten program exits, its
 * runtime cannot be reused.
 */
importScripts("/vendor/pdf-engines/qpdf.js")

self.onmessage = async (event) => {
  const { file, args } = event.data
  try {
    const qpdf = await Module({ locateFile: () => "/vendor/pdf-engines/qpdf.wasm" })
    qpdf.FS.writeFile("/in.pdf", new Uint8Array(await file.arrayBuffer()))
    let code
    try {
      code = qpdf.callMain(args)
    } catch (error) {
      if (typeof error?.status !== "number") throw error
      code = error.status
    }
    let output = null
    try {
      output = qpdf.FS.readFile("/out.pdf")
    } catch {
      // No output file: a check command, or qpdf failed.
    }
    self.postMessage({ code, output }, output ? [output.buffer] : [])
  } catch (error) {
    self.postMessage({ error: String(error?.message || error) })
  }
}
