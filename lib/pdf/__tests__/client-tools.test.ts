import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { PDFDocument, StandardFonts } from "pdf-lib"
import { extractPdfText, mergePdfs, parsePageRanges, pdfToDocx, splitPdf, watermarkPdf } from "../client-tools"

async function makePdf(pageTexts: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  for (const text of pageTexts) {
    const page = pdf.addPage([300, 400])
    text.split("\n").forEach((line, i) => page.drawText(line, { x: 20, y: 360 - i * 16, size: 12, font }))
  }
  return pdf.save()
}

const pageCount = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount()

describe("parsePageRanges", () => {
  it("parses ranges and singles, sorted and de-duplicated", () => {
    assert.deepEqual(parsePageRanges("5, 1-3, 2", 10), [1, 2, 3, 5])
  })
  it("clamps ranges to the document and drops out-of-range singles", () => {
    assert.deepEqual(parsePageRanges("8-20, 0, 99", 10), [8, 9, 10])
  })
  it("accepts reversed ranges and ignores junk", () => {
    assert.deepEqual(parsePageRanges("3-1, abc, ,", 5), [1, 2, 3])
  })
})

describe("mergePdfs / splitPdf", () => {
  it("merges every page in order", async () => {
    const a = await makePdf(["a1", "a2"])
    const b = await makePdf(["b1"])
    const merged = await mergePdfs([
      { name: "a.pdf", data: a },
      { name: "b.pdf", data: b },
    ])
    assert.equal(await pageCount(merged), 3)
  })
  it("needs at least two files", async () => {
    await assert.rejects(mergePdfs([{ name: "a.pdf", data: await makePdf(["x"]) }]), /at least 2/)
  })
  it("names the file that is not a PDF", async () => {
    const good = await makePdf(["x"])
    await assert.rejects(
      mergePdfs([
        { name: "good.pdf", data: good },
        { name: "bad.pdf", data: new TextEncoder().encode("not a pdf") },
      ]),
      /bad\.pdf could not be read/
    )
  })
  it("extracts only the requested pages", async () => {
    const split = await splitPdf(await makePdf(["1", "2", "3", "4"]), "2-3")
    assert.equal(await pageCount(split), 2)
  })
  it("rejects ranges with no valid pages", async () => {
    await assert.rejects(splitPdf(await makePdf(["1"]), "5-9"), /No valid pages/)
  })
})

describe("watermarkPdf", () => {
  it("keeps the page count and adds content", async () => {
    const original = await makePdf(["hello", "world"])
    const out = await watermarkPdf(original, {
      text: "CONFIDENTIAL",
      position: "center",
      fontSize: 48,
      opacity: 0.5,
      rotation: -45,
      color: "ff0000",
    })
    assert.equal(await pageCount(out), 2)
    assert.ok(out.length > original.length)
  })
})

describe("extractPdfText / pdfToDocx", () => {
  it("returns each page's text with line breaks", async () => {
    const pdf = await makePdf(["First line\nSecond line", "Page two"])
    const { pages, numPages } = await extractPdfText(new Blob([pdf as BlobPart]))
    assert.equal(numPages, 2)
    assert.equal(pages[0], "First line\nSecond line")
    assert.equal(pages[1], "Page two")
  })
  it("builds a docx from a text PDF", async () => {
    const docx = await pdfToDocx(new Blob([(await makePdf(["Heading", "Body text"])) as BlobPart]))
    const head = new Uint8Array(await docx.arrayBuffer()).slice(0, 2)
    assert.deepEqual([...head], [0x50, 0x4b]) // zip ("PK")
  })
  it("explains when a PDF has no text", async () => {
    const blank = await PDFDocument.create()
    blank.addPage()
    await assert.rejects(pdfToDocx(new Blob([(await blank.save()) as BlobPart])), /no selectable text/)
  })
})
