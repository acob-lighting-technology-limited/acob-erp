import { test } from "node:test"
import assert from "node:assert/strict"
import { buildAgendaDeck, planAgendaDeckPages, toRoman, type AgendaDeckInput } from "../agenda-deck"
import { planDepartmentHeading } from "../pptx"
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
  minutes: { pages: [image, image], label: "Minutes — Week 44, 2026" },
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

  // cover, agenda, prayer(3), KSS(4) + 3 pages, minutes(8) + 2 pages, departments(11) + index + 2×2, AOB(…)
  assert.deepEqual(startPages.slice(0, 4), [3, 4, 8, 11])
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
    minutes: { pages: [], label: "Minutes — Week 44, 2026", note: "No minutes have been uploaded for week 44." },
  })
  const { pres, slides } = fakePresentation()
  buildAgendaDeck(pres, input)
  const allText = slides.flat().join("\n")
  assert.match(allText, /No KSS file has been uploaded/)
  assert.match(allText, /No minutes have been uploaded for week 44/)
  assert.match(allText, /No weekly reports were submitted/)
  assert.match(allText, /no access/)
  // cover + agenda + 7 section slides + 1 birthday slide
  assert.equal(slides.length, 10)
})

test("only page 1 of the minutes is shown, with a pointer to the rest", () => {
  const input = baseInput({ minutes: { pages: [image], totalPages: 15, label: "Minutes — Week 22, 2026" } })
  const { pres, slides } = fakePresentation()
  buildAgendaDeck(pres, input)
  const allText = slides.flat().join("\n")
  assert.match(allText, /Page 1 of 15 shown/)
  assert.ok(slides.flat().includes("Page 1 of 15"))
  assert.equal(slides.length, planAgendaDeckPages(input).totalSlides)
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
