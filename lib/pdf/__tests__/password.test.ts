import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { PDFDocument } from "pdf-lib"
import { protectArgs, unlockArgs } from "../password"

/**
 * Runs the real qpdf WebAssembly build under Node, the way
 * public/workers/qpdf-worker.js does in the browser, to check the arguments.
 */
const require = createRequire(import.meta.url)
const createQpdf = require("@neslinesli93/qpdf-wasm")
const wasmPath = require.resolve("@neslinesli93/qpdf-wasm/dist/qpdf.wasm")

async function qpdf(input: Uint8Array, args: string[]) {
  const instance = await createQpdf({ locateFile: () => wasmPath, print: () => {}, printErr: () => {} })
  instance.FS.writeFile("/in.pdf", input)
  let code: number
  try {
    code = instance.callMain(args)
  } catch (error) {
    code = (error as { status: number }).status
  }
  // Under Node, Emscripten copies qpdf's exit status onto the test process.
  process.exitCode = 0
  let output: Uint8Array | null = null
  try {
    output = instance.FS.readFile("/out.pdf")
  } catch {
    // no output
  }
  return { code, output }
}

async function plainPdf() {
  const pdf = await PDFDocument.create()
  pdf.addPage()
  pdf.addPage()
  return pdf.save()
}

/** pdf-lib refuses encrypted files unless told otherwise. */
const isEncrypted = async (bytes: Uint8Array) =>
  PDFDocument.load(bytes).then(
    () => false,
    (error: Error) => /encrypted/i.test(error.message)
  )

describe("qpdf password arguments", () => {
  it("protects, and the right password removes it", async () => {
    const password = "-starts with a dash"
    const locked = await qpdf(await plainPdf(), protectArgs(password))
    assert.equal(locked.code, 0)
    assert.ok(locked.output)
    assert.equal(await isEncrypted(locked.output), true)

    const unlocked = await qpdf(locked.output, unlockArgs(password))
    assert.equal(unlocked.code, 0)
    assert.ok(unlocked.output)
    assert.equal(await isEncrypted(unlocked.output), false)
    assert.equal((await PDFDocument.load(unlocked.output)).getPageCount(), 2)
  })

  it("rejects a wrong password", async () => {
    const locked = await qpdf(await plainPdf(), protectArgs("right"))
    assert.ok(locked.output)
    assert.equal((await qpdf(locked.output, unlockArgs("wrong"))).code, 2)
  })

  it("fails to protect a file that already has a password", async () => {
    const locked = await qpdf(await plainPdf(), protectArgs("first"))
    assert.ok(locked.output)
    assert.equal((await qpdf(locked.output, protectArgs("second"))).code, 2)
  })
})
