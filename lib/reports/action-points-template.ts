import "server-only"

import { readFile } from "node:fs/promises"
import { join } from "node:path"
import JSZip from "jszip"
import type { ActionItem } from "@/lib/export-utils"
import {
  getActionPointsDepartmentHeading,
  getCanonicalDepartmentOrder,
  normalizeDepartmentName,
} from "@/shared/departments"

const TEMPLATE_FILE = join(process.cwd(), "ACTION POINTS - 9TH MARCH 2026.docx")
const SAFE_SECTION_SPACER_XML =
  '<w:p><w:pPr><w:pStyle w:val="BodyText"/><w:spacing w:before="25"/><w:ind w:left="0" w:firstLine="0"/></w:pPr></w:p>'
const DEPARTMENT_ORDER = getCanonicalDepartmentOrder().filter((department) => department !== "Executive Management")

const TEMPLATE_HEADINGS = [
  { key: "Accounts", candidates: ["ACCOUNTS DEPARTMEMT:"] },
  { key: "Admin & HR", candidates: ["ADMIN/HR:"] },
  { key: "Business, Growth and Innovation", candidates: ["BUSINESS GROWTH AND INNOVATION:"] },
  { key: "IT and Communications", candidates: ["IT & COMMUNICATIONS DEPARTMENT:"] },
  {
    key: "Operations and Maintenance",
    candidates: ["OPERATIONS AND MAINTENANCE DEPARTMENT:", "OPERATIONS DEPARTMENT:"],
  },
  { key: "Project", candidates: ["PROJECT DEPARTMENT:"] },
  { key: "Legal, Regulatory and Compliance", candidates: ["REGULATORY & COMPLIANCE DEPARTMENT:"] },
  { key: "Technical", candidates: ["TECHNICAL DEPARTMENT"] },
] as const

const decodeXml = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2019;/gi, "'")

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const normalizeTemplateText = (value: unknown) =>
  String(value ?? "")
    .replace(/\f/g, " ") // Ctrl+L (form feed) → space
    .replace(/[\x00-\x09\x0B\x0E-\x1F]/g, "") // strip remaining control chars (keep \n \r \t)
    .replace(/\r\n|\r|\n/g, " ") // collapse line breaks into spaces (single bullet line)
    .replace(/\s+/g, " ") // collapse multiple spaces
    .trim()

const getParagraphs = (documentXml: string) => documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []

const getParagraphText = (paragraphXml: string) =>
  decodeXml(
    Array.from(paragraphXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
      .map((match) => match[1])
      .join("")
  ).trim()

const replaceParagraphText = (paragraphXml: string, text: string) => {
  const escaped = escapeXml(text)
  let replaced = false
  return paragraphXml.replace(/<w:t(\s[^>]*)?>[\s\S]*?<\/w:t>/g, (match, attrs = "") => {
    if (replaced) return ""
    replaced = true
    return `<w:t${attrs}>${escaped}</w:t>`
  })
}

const setParagraphAlignment = (paragraphXml: string, alignment: "left" | "both") => {
  const alignmentXml = `<w:jc w:val="${alignment}"/>`

  if (paragraphXml.includes("<w:pPr")) {
    if (paragraphXml.match(/<w:jc\b[^>]*\/>/)) {
      return paragraphXml.replace(/<w:jc\b[^>]*\/>/, alignmentXml)
    }

    return paragraphXml.replace("<w:pPr>", `<w:pPr>${alignmentXml}`)
  }

  return paragraphXml.replace("<w:p>", `<w:p><w:pPr>${alignmentXml}</w:pPr>`)
}

const setParagraphKeepNext = (paragraphXml: string) => {
  if (paragraphXml.includes("<w:keepNext")) return paragraphXml
  if (paragraphXml.includes("<w:pPr")) {
    return paragraphXml.replace(/<w:pPr[^>]*>/, "$&<w:keepNext/>")
  }
  return paragraphXml.replace(/<w:p(\s[^>]*)?>/, "$&<w:pPr><w:keepNext/></w:pPr>")
}

const normalizeBulletSpacing = (paragraphXml: string) =>
  paragraphXml.replace(/<w:spacing[^/]*\/>/, '<w:spacing w:before="57" w:line="290" w:lineRule="auto"/>')

const normalizeSpacerSpacing = (paragraphXml: string) =>
  paragraphXml.replace(/<w:spacing[^/]*\/>/, '<w:spacing w:before="25"/>')

const groupActionItemsByDepartment = (actions: ActionItem[]) => {
  const grouped: Record<string, ActionItem[]> = {}
  actions.forEach((action) => {
    const department = normalizeDepartmentName(action.department)
    if (!grouped[department]) grouped[department] = []
    grouped[department].push({ ...action, department })
  })

  const departments = DEPARTMENT_ORDER.filter((dept) => grouped[dept])
  Object.keys(grouped).forEach((dept) => {
    if (!departments.includes(dept)) departments.push(dept)
  })

  return { grouped, departments }
}

const formatActionPointsDate = (week: number, year: number, meetingDate?: string) => {
  if (meetingDate) {
    const parsed = new Date(`${meetingDate}T00:00:00`)
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed)
    }
  }

  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
  while (simple.getUTCDay() !== 1) simple.setUTCDate(simple.getUTCDate() - 1)
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(simple)
}

export async function generateActionPointsDocxBuffer(
  actions: ActionItem[],
  week: number,
  year: number,
  meetingDate?: string
) {
  const templateBuffer = await readFile(TEMPLATE_FILE)
  const zip = await JSZip.loadAsync(templateBuffer)
  const documentXml = await zip.file("word/document.xml")?.async("string")
  if (!documentXml) throw new Error("Action Points template is missing word/document.xml")

  const paragraphs = getParagraphs(documentXml)
  const bodyStart = documentXml.indexOf("<w:body>")
  const bodyEnd = documentXml.indexOf("</w:body>")
  if (bodyStart === -1 || bodyEnd === -1) throw new Error("Invalid Action Points template structure")

  const paragraphInfo = paragraphs.map((xml, index) => ({ index, xml, text: getParagraphText(xml) }))
  const dateParagraphIndex = paragraphInfo.find((item) => item.text.startsWith("Date:"))?.index
  if (typeof dateParagraphIndex !== "number") throw new Error("Template date paragraph not found")

  const headingMatches = TEMPLATE_HEADINGS.map((heading) => {
    const found = paragraphInfo.find((item) => heading.candidates.some((candidate) => candidate === item.text))
    if (!found) throw new Error(`Template heading not found for: ${heading.key}`)
    return { ...heading, index: found.index }
  })

  const sections = headingMatches.map((headingMatch, idx) => {
    const headingIndex = headingMatch.index
    const nextHeadingIndex = headingMatches[idx + 1]?.index ?? paragraphs.length
    const headingXml = paragraphs[headingMatch.index]
    const sectionParagraphs = paragraphs.slice(headingIndex + 1, nextHeadingIndex)
    const bulletParagraphs = sectionParagraphs.filter((xml) => getParagraphText(xml).length > 0)
    const blankParagraphXml =
      sectionParagraphs.find((xml) => getParagraphText(xml).length === 0 && !xml.includes("<w:sectPr")) ??
      SAFE_SECTION_SPACER_XML
    if (bulletParagraphs.length === 0)
      throw new Error(`Template section has no bullet paragraph for: ${headingMatch.key}`)
    return {
      headingKey: headingMatch.key,
      headingXml,
      bulletTemplateXml: normalizeBulletSpacing(bulletParagraphs[0]),
      blankParagraphXml: normalizeSpacerSpacing(blankParagraphXml),
    }
  })
  const fallbackSection = sections[0]

  const { grouped, departments } = groupActionItemsByDepartment(actions)
  const builtParagraphs: string[] = []

  paragraphs.forEach((xml, index) => {
    if (index < headingMatches[0].index) {
      if (index === dateParagraphIndex) {
        builtParagraphs.push(
          setParagraphAlignment(
            replaceParagraphText(xml, `Date: ${formatActionPointsDate(week, year, meetingDate)}`),
            "both"
          )
        )
      } else {
        builtParagraphs.push(setParagraphAlignment(xml, "both"))
      }
    }
  })

  departments.forEach((department) => {
    const dynamicHeading = getActionPointsDepartmentHeading(department)
    const section = sections.find((item) => item.headingKey === normalizeDepartmentName(department)) || fallbackSection
    if (!section) throw new Error(`No template section available for department: ${department}`)

    builtParagraphs.push(
      setParagraphKeepNext(setParagraphAlignment(replaceParagraphText(section.headingXml, dynamicHeading), "both"))
    )
    ;(grouped[department] || []).forEach((action) => {
      builtParagraphs.push(
        setParagraphAlignment(
          replaceParagraphText(section.bulletTemplateXml, normalizeTemplateText(action.title)),
          "both"
        )
      )
    })
    builtParagraphs.push(setParagraphAlignment(section.blankParagraphXml, "both"))
  })

  const rebuiltDocumentXml =
    documentXml.slice(0, bodyStart + "<w:body>".length) + builtParagraphs.join("") + documentXml.slice(bodyEnd)

  zip.file("word/document.xml", rebuiltDocumentXml)
  return zip.generateAsync({ type: "uint8array" })
}
