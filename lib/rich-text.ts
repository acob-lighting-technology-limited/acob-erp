/**
 * Helpers for the shared rich text editor (components/ui/rich-text-editor.tsx).
 * Browser-only: DOMPurify and DOMParser need a document.
 */
import DOMPurify from "dompurify"
import { escapeHtml } from "@/lib/email-templates/utils"

function parseInlineMarkdown(text: string): string {
  let html = escapeHtml(text)

  // 1. Inline code: `code` -> <code>code</code>
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>")

  // 2. Bold: **bold** -> <strong>bold</strong>
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")

  // 3. Italic: *italic* or _italic_ -> <em>italic</em>
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>")
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>")

  // 4. Links: [text](url) -> <a href="url" target="_blank" rel="noopener noreferrer">text</a>
  // Only permit HTTP and HTTPS URLs for safety
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  )

  return html
}

/** Pasted plain text to HTML: markdown headings, lists, bold/italic, code and links. */
export function convertMarkdownToHtml(text: string): string {
  const lines = text.split(/\r?\n/)
  const result: string[] = []

  let currentListType: "ul" | "ol" | null = null
  let currentParagraphLines: string[] = []

  const closeList = () => {
    if (currentListType === "ul") {
      result.push("</ul>")
    } else if (currentListType === "ol") {
      result.push("</ol>")
    }
    currentListType = null
  }

  const closeParagraph = () => {
    if (currentParagraphLines.length > 0) {
      result.push(`<p>${currentParagraphLines.join("<br>")}</p>`)
      currentParagraphLines = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      closeList()
      closeParagraph()
      continue
    }

    // Check for headers: #, ##, ###
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (headerMatch) {
      closeList()
      closeParagraph()
      const level = headerMatch[1].length
      const headerText = parseInlineMarkdown(headerMatch[2])
      result.push(`<h${level}>${headerText}</h${level}>`)
      continue
    }

    // Check for unordered list item: * or - or •
    const ulMatch = trimmed.match(/^([*-]|•)\s+(.*)$/)
    if (ulMatch) {
      closeParagraph()
      if (currentListType !== "ul") {
        closeList()
        result.push("<ul>")
        currentListType = "ul"
      }
      const itemText = parseInlineMarkdown(ulMatch[2])
      result.push(`<li>${itemText}</li>`)
      continue
    }

    // Check for ordered list item: 1.
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
    if (olMatch) {
      closeParagraph()
      if (currentListType !== "ol") {
        closeList()
        result.push("<ol>")
        currentListType = "ol"
      }
      const itemText = parseInlineMarkdown(olMatch[2])
      result.push(`<li>${itemText}</li>`)
      continue
    }

    // Standard paragraph line
    closeList()
    currentParagraphLines.push(parseInlineMarkdown(trimmed))
  }

  closeList()
  closeParagraph()

  const finalHtml = result.filter(Boolean).join("")
  return finalHtml || "<p><br></p>"
}

/**
 * The formatting a minutes summary keeps — what a PowerPoint text slide can
 * show. Everything else (fonts, colours, tables, images, links) is dropped, so
 * the editor never shows formatting the agenda deck cannot reproduce.
 */
const SLIDE_TEXT_TAGS = ["p", "br", "h1", "h2", "h3", "h4", "ul", "ol", "li", "strong", "b", "em", "i"]
/** `start` keeps a numbered list's first number when other paragraphs interrupt it. */
const SLIDE_TEXT_ATTRS = ["start"]

/**
 * Word writes list items as paragraphs that start with a bullet glyph or a
 * number ("·  text", "1.  text") rather than as <ul>/<ol>. A leading marker
 * followed by whitespace marks one.
 */
const WORD_BULLET = /^[\s ]*[·•▪●§o–*-][\s ]+/
const WORD_NUMBER = /^[\s ]*\d+[.)][\s ]+/

/**
 * Drop the first `count` characters of the element's text. The marker can span
 * text nodes — Word puts the glyph and its spacing in separate spans.
 */
function stripLeadingChars(element: Element, count: number) {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let left = count
  for (let node = walker.nextNode(); node && left > 0; node = walker.nextNode()) {
    const text = node.textContent ?? ""
    node.textContent = text.slice(left)
    left -= Math.min(left, text.length)
  }
}

/** A section number on a line of its own ("1.0", "2.", "3.1"). */
const SECTION_NUMBER = /^\d+(\.\d+)*\.?$/

/** A short line with letters and no lowercase ("OPENING", "ANY OTHER BUSINESS"). */
const isCapsHeading = (line: string) => line.length <= 80 && /\p{L}/u.test(line) && !/\p{Ll}/u.test(line)

/**
 * Text copied from a PDF comes as lines with hard breaks rather than
 * paragraphs. Rebuild the paragraphs: a line well short of the typical line
 * length ends its paragraph, an all-caps line is a heading (a section number on
 * the line before it, such as "1.0", is folded in), and bullet or number
 * markers start list items.
 */
export function plainTextToSlideHtml(text: string): string {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/[\s ]+/g, " ").trim())
  const lengths = lines
    .filter((line) => line.length > 20)
    .map((line) => line.length)
    .sort((a, b) => a - b)
  const typical = lengths.length > 0 ? lengths[Math.floor(lengths.length * 0.8)] : 0

  const blocks: { tag: "p" | "h3" | "ul" | "ol"; text: string }[] = []
  let open: (typeof blocks)[number] | null = null
  let sectionNumber = ""
  for (const line of lines) {
    if (!line) {
      open = null
      continue
    }
    if (SECTION_NUMBER.test(line)) {
      open = null
      sectionNumber = line
      continue
    }
    if (isCapsHeading(line)) {
      blocks.push({ tag: "h3", text: [sectionNumber, line].filter(Boolean).join(" ") })
      sectionNumber = ""
      open = null
      continue
    }
    const bullet = line.match(WORD_BULLET)
    const number = bullet ? null : line.match(WORD_NUMBER)
    const marker = bullet ?? number
    if (marker || !open) {
      const body = marker ? line.slice(marker[0].length) : line
      open = { tag: bullet ? "ul" : number ? "ol" : "p", text: [sectionNumber, body].filter(Boolean).join(" ") }
      sectionNumber = ""
      blocks.push(open)
    } else {
      open.text += ` ${line}`
    }
    if (!typical || line.length < typical * 0.75) open = null
  }
  if (sectionNumber) blocks.push({ tag: "p", text: sectionNumber })

  let html = ""
  blocks.forEach((block, i) => {
    const text = escapeHtml(block.text)
    if (block.tag === "p" || block.tag === "h3") {
      html += `<${block.tag}>${text}</${block.tag}>`
      return
    }
    if (blocks[i - 1]?.tag !== block.tag) html += `<${block.tag}>`
    html += `<li>${text}</li>`
    if (blocks[i + 1]?.tag !== block.tag) html += `</${block.tag}>`
  })
  return html
}

const BLOCK_TAG = /<(p|h[1-6]|ul|ol|li)[\s>]/i

/**
 * Sanitised slide HTML with no paragraphs at all but hard line breaks is
 * PDF-style plain text; rebuild its paragraphs (see plainTextToSlideHtml).
 */
function structurePlainText(sanitized: string): string {
  if (BLOCK_TAG.test(sanitized)) return sanitized
  const withNewlines = sanitized.replace(/<br\s*\/?>/gi, "\n")
  if (!withNewlines.includes("\n")) return sanitized
  const text = new DOMParser().parseFromString(`<body>${withNewlines}</body>`, "text/html").body.textContent ?? ""
  return plainTextToSlideHtml(text)
}

/**
 * Pasted or typed HTML reduced to slide text: allowed tags only, no attributes,
 * <b>/<i>/<div> normalised to <strong>/<em>/<p>, Word's paragraph-lists turned
 * into real lists, and PDF-style hard-wrapped text rebuilt into paragraphs.
 * Used on paste into, and on save from, the minutes summary editor.
 */
export function cleanSlideTextHtml(html: string): string {
  // Chrome's contentEditable writes each new line as <div>; keep them as paragraphs.
  const withParagraphs = html.replace(/<div(\s[^>]*)?>/gi, "<p>").replace(/<\/div>/gi, "</p>")
  const sanitized = structurePlainText(
    DOMPurify.sanitize(withParagraphs, { ALLOWED_TAGS: SLIDE_TEXT_TAGS, ALLOWED_ATTR: SLIDE_TEXT_ATTRS })
  )
  const doc = new DOMParser().parseFromString(`<body>${sanitized}</body>`, "text/html")

  doc.body
    .querySelectorAll("b")
    .forEach((el) => el.replaceWith(Object.assign(doc.createElement("strong"), { innerHTML: el.innerHTML })))
  doc.body
    .querySelectorAll("i")
    .forEach((el) => el.replaceWith(Object.assign(doc.createElement("em"), { innerHTML: el.innerHTML })))

  let list: HTMLElement | null = null
  for (const child of Array.from(doc.body.children)) {
    const text = child.textContent ?? ""
    const bullet = child.tagName === "P" ? text.match(WORD_BULLET) : null
    const number = child.tagName === "P" && !bullet ? text.match(WORD_NUMBER) : null
    const marker = bullet ?? number
    if (!marker) {
      list = null
      continue
    }
    const kind = bullet ? "ul" : "ol"
    stripLeadingChars(child, marker[0].length)
    // Word's own number, which a list broken up by paragraphs would otherwise restart at 1.
    const wordNumber = number ? parseInt(number[0].trim(), 10) : 1
    // A numbered all-caps line is a section title ("2. ADOPTION OF PREVIOUS MINUTES:"),
    // not a list item: a heading that keeps its number.
    if (number && isCapsHeading((child.textContent ?? "").trim())) {
      const heading = doc.createElement("h3")
      heading.innerHTML = `${wordNumber}. ${child.innerHTML.trim()}`
      child.replaceWith(heading)
      list = null
      continue
    }
    if (!list || list.tagName.toLowerCase() !== kind) {
      list = doc.createElement(kind)
      if (kind === "ol" && wordNumber > 1) list.setAttribute("start", String(wordNumber))
      child.before(list)
    }
    const item = doc.createElement("li")
    item.innerHTML = child.innerHTML
    list.append(item)
    child.remove()
  }

  // Empty paragraphs (Word's spacing, stray <br>s) carry nothing to a slide.
  doc.body.querySelectorAll("p, li, h1, h2, h3, h4").forEach((el) => {
    if (!(el.textContent ?? "").replace(/ /g, " ").trim()) el.remove()
  })
  return doc.body.innerHTML
}

/**
 * Sanitise stored slide text for display (it is cleaned on save, but never
 * trust stored HTML). Summaries saved as hard-wrapped text before paragraphs
 * were rebuilt on paste get their paragraphs here.
 */
export function sanitizeSlideTextHtml(html: string): string {
  return structurePlainText(DOMPurify.sanitize(html, { ALLOWED_TAGS: SLIDE_TEXT_TAGS, ALLOWED_ATTR: SLIDE_TEXT_ATTRS }))
}

export interface SlideTextRun {
  text: string
  bold?: boolean
  italic?: boolean
}

/**
 * One paragraph of slide text. `number` is the item's position in its numbered
 * list; `continued` marks the rest of a paragraph split across slides (no
 * second bullet or number).
 */
export interface SlideTextBlock {
  kind: "heading" | "paragraph" | "bullet" | "number"
  runs: SlideTextRun[]
  number?: number
  continued?: boolean
}

/** Inline content as runs, carrying bold/italic down from <strong>/<em>; <br> becomes a newline. */
function collectRuns(node: Node, style: { bold: boolean; italic: boolean }, runs: SlideTextRun[]) {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? "").replace(/ /g, " ").replace(/\s+/g, " ")
      if (text) runs.push({ text, ...(style.bold && { bold: true }), ...(style.italic && { italic: true }) })
      return
    }
    if (!(child instanceof Element)) return
    const tag = child.tagName.toLowerCase()
    if (tag === "br") {
      runs.push({ text: "\n" })
      return
    }
    collectRuns(
      child,
      { bold: style.bold || tag === "strong" || tag === "b", italic: style.italic || tag === "em" || tag === "i" },
      runs
    )
  })
}

function trimRuns(runs: SlideTextRun[]) {
  if (runs.length === 0) return runs
  runs[0] = { ...runs[0], text: runs[0].text.replace(/^\s+/, "") }
  const last = runs.length - 1
  runs[last] = { ...runs[last], text: runs[last].text.replace(/\s+$/, "") }
  return runs.filter((run) => run.text.length > 0)
}

/** Summary HTML (already cleaned to slide-text tags) as blocks the agenda deck lays out as text slides. */
export function htmlToSlideTextBlocks(html: string): SlideTextBlock[] {
  const doc = new DOMParser().parseFromString(`<body>${sanitizeSlideTextHtml(html)}</body>`, "text/html")
  const blocks: SlideTextBlock[] = []
  const pushBlock = (kind: SlideTextBlock["kind"], element: Element, number?: number) => {
    const runs: SlideTextRun[] = []
    collectRuns(element, { bold: kind === "heading", italic: false }, runs)
    const trimmed = trimRuns(runs)
    if (trimmed.length > 0) blocks.push({ kind, runs: trimmed, ...(number !== undefined && { number }) })
  }

  for (const child of Array.from(doc.body.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? "").replace(/[\s ]+/g, " ").trim()
      if (text) blocks.push({ kind: "paragraph", runs: [{ text }] })
      continue
    }
    if (!(child instanceof Element)) continue
    const tag = child.tagName.toLowerCase()
    if (/^h[1-4]$/.test(tag)) pushBlock("heading", child)
    else if (tag === "ul") child.querySelectorAll(":scope > li").forEach((li) => pushBlock("bullet", li))
    else if (tag === "ol") {
      const start = Number(child.getAttribute("start")) || 1
      Array.from(child.querySelectorAll(":scope > li")).forEach((li, i) => pushBlock("number", li, start + i))
    } else pushBlock("paragraph", child)
  }
  return blocks
}
