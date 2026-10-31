import { test } from "node:test"
import assert from "node:assert/strict"
import { buildAgendaDeck, planAgendaDeckPages, type AgendaDeckInput } from "../agenda-deck"
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
  birthdays: [
    { title: "Birthdays in the Past Week", image },
    { title: "Upcoming Birthdays", image: null, note: "Nov 2 – Nov 8 — no access" },
  ],
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
      slides[page - 1].some((text) => text.startsWith(`AGENDA 0${i + 1} OF 07`)),
      `item ${i + 1} on slide ${page}`
    )
  })
})

test("missing pieces leave a note on the section slide instead of failing", () => {
  const input = baseInput({
    reports: [],
    kss: [],
    minutes: { pages: [], label: "Minutes — Week 44, 2026", note: "No minutes have been uploaded for week 44." },
  })
  const { pres, slides } = fakePresentation()
  buildAgendaDeck(pres, input)
  const allText = slides.flat().join("\n")
  assert.match(allText, /No KSS file has been uploaded/)
  assert.match(allText, /No minutes have been uploaded for week 44/)
  assert.match(allText, /No weekly reports were submitted/)
  // 2 + 7 section slides + 2 birthday slides
  assert.equal(slides.length, 11)
})
