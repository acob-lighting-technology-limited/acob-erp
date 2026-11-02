import { test } from "node:test"
import assert from "node:assert/strict"
import { buildAgendaDeck, paginateSlideText, planAgendaDeckPages, toRoman, type AgendaDeckInput } from "../agenda-deck"
import { planDepartmentHeading } from "../pptx"
import { plainTextToSlideHtml } from "@/lib/rich-text"
import type { PptxPresentation, PptxTextRun, WeeklyReport } from "../shared"

/** Records every slide and the plain text placed on it. */
function fakePresentation() {
  const slides: string[][] = []
  const pres: PptxPresentation = {
    layout: "",
    addSlide: () => {
      const texts: string[] = []
      slides.push(texts)
      return {
        addShape: () => {},
        addImage: () => {},
        addText: (text: string | PptxTextRun[]) => {
          texts.push(typeof text === "string" ? text : text.map((run) => run.text).join(""))
        },
      }
    },
    writeFile: async () => "",
  }
  return { pres, slides }
}

const image = { dataUrl: "data:image/jpeg;base64,AAAA", width: 1920, height: 1080 }

const report = (department: string): WeeklyReport => ({
  id: department,
  department,
  week_number: 45,
  year: 2026,
  work_done: "1. Did things",
  tasks_new_week: "1. More things",
  challenges: "None",
  status: "submitted",
  user_id: "u",
  created_at: "2026-11-01",
})

const baseInput = (overrides: Partial<AgendaDeckInput> = {}): AgendaDeckInput => ({
  week: 45,
  year: 2026,
  meetingDate: "2026-11-02",
  mode: "compact",
  theme: "light",
  order: "default",
  reports: [report("Accounts"), report("IT and Communications")],
  kss: [{ presenterName: "Ada", department: "Accounts", pages: [image, image, image] }],
  minutes: {
    summary: [{ kind: "paragraph", runs: [{ text: "The meeting opened with prayers." }] }],
    label: "Summary of Minutes — Week 44, 2026",
  },
  birthdays: [{ title: "Birthdays — past week & coming up", image }],
  ...overrides,
})

test("agenda deck slide count matches the planned pages", () => {
  for (const mode of ["compact", "full"] as const) {
    const input = baseInput({ mode })
    const { pres, slides } = fakePresentation()
    buildAgendaDeck(pres, input)
    assert.equal(slides.length, planAgendaDeckPages(input).totalSlides, `mode ${mode}`)
  }
})

test("agenda slide points each item at the slide its section starts on", () => {
  const input = baseInput()
  const { pres, slides } = fakePresentation()
  buildAgendaDeck(pres, input)
  const { startPages } = planAgendaDeckPages(input)

  // cover, agenda, prayer(3), KSS(4) + 3 pages, minutes(8) + 1 summary slide, departments(10) + index + 2×2, AOB(…)
  assert.deepEqual(startPages.slice(0, 4), [3, 4, 8, 10])
  startPages.forEach((page, i) => {
    assert.ok(
      slides[page - 1].some((text) => text.startsWith(`AGENDA ${toRoman(i + 1)} OF VII`)),
      `item ${i + 1} on slide ${page}`
    )
  })
})

test("missing pieces leave a note on the section slide instead of failing", () => {
  const input = baseInput({
    reports: [],
    kss: [],
    birthdays: [{ title: "Birthdays — past week & coming up", image: null, note: "Oct 26 – Nov 1 — no access" }],
    minutes: { label: "Summary of Minutes — Week 44, 2026", note: "No summary of minutes for week 44." },
  })
  const { pres, slides } = fakePresentation()
  buildAgendaDeck(pres, input)
  const allText = slides.flat().join("\n")
  assert.match(allText, /No KSS file has been uploaded/)
  assert.match(allText, /No summary of minutes for week 44/)
  assert.match(allText, /No weekly reports were submitted/)
  assert.match(allText, /no access/)
  // cover + agenda + 7 section slides + 1 birthday slide
  assert.equal(slides.length, 10)
})

test("department headings stay at 54pt and wrap long names onto two lines", () => {
  const short = planDepartmentHeading("Accounts")
  assert.deepEqual([short.text, short.fontSize], ["ACCOUNTS", 54])

  for (const [name, expected] of [
    ["Regulatory and Compliance", "REGULATORY AND\nCOMPLIANCE"],
    ["Operations and Maintenance", "OPERATIONS AND\nMAINTENANCE"],
    ["Business, Growth and Innovation", "BUSINESS, GROWTH AND\nINNOVATION"],
  ]) {
    const heading = planDepartmentHeading(name)
    assert.equal(heading.text, expected)
    assert.equal(heading.fontSize, 54)
    // Grows upwards: the bottom stays on the rule, the eyebrow sits above.
    assert.ok(Math.abs(heading.y + heading.height - 4.42) < 1e-9)
    assert.ok(heading.eyebrowY < heading.y)
  }
})

test("agenda items are numbered in Roman numerals", () => {
  const { pres, slides } = fakePresentation()
  buildAgendaDeck(pres, baseInput())
  const allText = slides.flat()
  assert.ok(allText.includes("AGENDA VII OF VII"))
  assert.ok(allText.includes("IV"))
})

test("a summary of minutes is laid out as text slides", () => {
  const summary = [
    { kind: "heading" as const, runs: [{ text: "Unit Updates" }] },
    ...Array.from({ length: 40 }, (_, i) => ({
      kind: "bullet" as const,
      runs: [{ text: `Department ${i + 1} reported steady progress on its targets for the week.` }],
    })),
  ]
  const input = baseInput({
    minutes: { summary, label: "Summary of Minutes — Week 22, 2026" },
  })
  const pages = paginateSlideText(summary)
  assert.ok(pages.length > 1, "40 bullets do not fit one slide")
  assert.deepEqual(pages.flat(), summary, "pagination keeps every block, in order")

  const { pres, slides } = fakePresentation()
  buildAgendaDeck(pres, input)
  assert.equal(slides.length, planAgendaDeckPages(input).totalSlides)
  const allText = slides.flat()
  assert.ok(allText.includes(`1 of ${pages.length}`))
  assert.ok(allText.some((text) => text.includes("Department 40 reported")))
})

test("a heading is never left alone at the bottom of a summary slide", () => {
  const filler = Array.from({ length: 13 }, () => ({
    kind: "paragraph" as const,
    runs: [{ text: "A paragraph of summary text that fills one line on the slide." }],
  }))
  const pages = paginateSlideText([...filler, { kind: "heading", runs: [{ text: "Next Section" }] }, ...filler])
  for (const page of pages) assert.notEqual(page[page.length - 1].kind, "heading")
})

test("text copied from a PDF gets its paragraphs, headings and lists back", () => {
  const long = "The session explained the importance of conducting proper community assessments before"
  const html = plainTextToSlideHtml(
    ["1.0", "OPENING", long, "a.m. with prayers.", long, "the end.", "• First point", "• Second point"].join("\n")
  )
  assert.equal(
    html,
    `<h3>1.0 OPENING</h3><p>${long} a.m. with prayers.</p><p>${long} the end.</p>` +
      "<ul><li>First point</li><li>Second point</li></ul>"
  )
})

test("a paragraph taller than a slide is split across slides without losing text", () => {
  const sentence = "Department heads reported steady progress on their targets for the week. "
  const block = { kind: "bullet" as const, runs: [{ text: sentence.repeat(80).trim() }] }
  const pages = paginateSlideText([block])
  assert.ok(pages.length > 1)
  const pieces = pages.flat()
  assert.equal(pieces.map((piece) => piece.runs.map((run) => run.text).join("")).join(" "), block.runs[0].text)
  assert.deepEqual(
    pieces.map((piece) => !!piece.continued),
    pieces.map((_, i) => i > 0)
  )
  // Pieces break after a sentence, not mid-sentence.
  for (const piece of pieces.slice(0, -1)) assert.match(piece.runs[piece.runs.length - 1].text, /\.$/)
})
