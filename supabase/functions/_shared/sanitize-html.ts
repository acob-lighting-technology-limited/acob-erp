/**
 * Server-side HTML sanitizer for edge functions.
 * Allowlist-based — strips everything not explicitly allowed.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "b",
  "i",
  "u",
  "strong",
  "em",
  "a",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "code",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "div",
  "span",
  "img",
  "hr",
  "sub",
  "sup",
])

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan"]),
  "*": new Set(["style", "class"]),
}

const DANGEROUS_STYLE_PATTERNS = [
  /expression\s*\(/gi,
  /javascript\s*:/gi,
  /behavior\s*:/gi,
  /-moz-binding\s*:/gi,
  /url\s*\(\s*['"]?\s*javascript/gi,
]

export function sanitizeHtml(html: string): string {
  let clean = html.replace(/<script[\s\S]*?<\/script>/gi, "")

  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
  clean = clean.replace(/javascript\s*:/gi, "")
  clean = clean.replace(/(<(?!img)[^>]+)\bsrc\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi, "$1")
  clean = clean.replace(/vbscript\s*:/gi, "")

  clean = clean.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/gi, (match, tagName) => {
    const tag = tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return ""

    if (match.startsWith("</")) return `</${tag}>`

    const allowedAttrs = new Set([...(ALLOWED_ATTRS[tag] || []), ...(ALLOWED_ATTRS["*"] || [])])
    const attrRegex = /\s+([a-zA-Z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g
    let attrs = ""
    let attrMatch: RegExpExecArray | null

    while ((attrMatch = attrRegex.exec(match)) !== null) {
      const attrName = attrMatch[1].toLowerCase()
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ""

      if (!allowedAttrs.has(attrName)) continue
      if (attrName === "href" && /^\s*javascript:/i.test(attrValue)) continue
      if (attrName === "src" && /^\s*javascript:/i.test(attrValue)) continue

      if (attrName === "style") {
        let safeStyle = attrValue
        for (const pattern of DANGEROUS_STYLE_PATTERNS) {
          safeStyle = safeStyle.replace(pattern, "")
        }
        attrs += ` style="${safeStyle}"`
        continue
      }

      attrs += ` ${attrName}="${attrValue}"`
    }

    const selfClosing = match.endsWith("/>") || ["br", "hr", "img"].includes(tag)
    return `<${tag}${attrs}${selfClosing ? " /" : ""}>`
  })

  clean = clean.replace(/<!--[\s\S]*?-->/g, "")

  return clean
}
