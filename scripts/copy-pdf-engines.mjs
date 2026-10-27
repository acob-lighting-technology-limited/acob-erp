/**
 * Copy the WebAssembly engines the browser PDF tools load at runtime into
 * public/vendor/pdf-engines (git-ignored), so they are served from our own
 * origin. Runs on `npm install` (postinstall) and before `next build`.
 *
 *   qpdf          — add / remove password   (lib/pdf/password.ts)
 *   tesseract.js  — OCR, plus English data  (lib/pdf/ocr.ts)
 */
import { copyFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const target = path.join(root, "public", "vendor", "pdf-engines")

const files = [
  "@neslinesli93/qpdf-wasm/dist/qpdf.js",
  "@neslinesli93/qpdf-wasm/dist/qpdf.wasm",
  "tesseract.js/dist/worker.min.js",
  // tesseract.js picks one of these by CPU support (LSTM engine only).
  "tesseract.js-core/tesseract-core-lstm.wasm.js",
  "tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
  "tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js",
  // The model tesseract.js uses for the LSTM engine by default.
  "@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
]

mkdirSync(target, { recursive: true })
for (const file of files) {
  copyFileSync(path.join(root, "node_modules", file), path.join(target, path.basename(file)))
}
console.log(`Copied ${files.length} PDF engine files to public/vendor/pdf-engines`)
