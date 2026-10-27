// Rules for the UI ratchet. Each one is a rule AGENTS.md already states and that nothing else enforces.
// A rule turns a file's text into a count; ratchet.mjs compares that count to the committed baseline.

const HINTS = {
  "tiny-text": "Minimum text size is text-xs (12px). Use text-xs.",
  "locale-without-en-ng":
    "Use the helpers in @/lib/utils/date (formatWATDate...), or pass en-NG and timeZone: \"Africa/Lagos\". Business time is Lagos time.",
  "raw-img": "Use next/image. A raw <img> is only for email/PDF/OG renderers.",
  "window-dialogs": "Confirm with AlertDialog (or useConfirm) and notify with sonner. No window.confirm/alert/prompt.",
  "key-index": "Use a stable id as the React key, not the array index.",
  "dialog-in-page": "Move <DialogContent> out of the page/view file into _components/.",
  "explicit-any": "Type it. Use unknown plus a narrowing, or a real type.",
  "eslint-disable": "Fix the cause instead of disabling the rule.",
  "select-star": 'List the columns: .select("id, name") instead of .select("*").',
  "inline-query-key": "Add the key to lib/query-keys.ts and use QUERY_KEYS so invalidation finds it.",
  "dark-color-override": "Do not fix a colour with dark: overrides. Use a theme token or StatusBadge.",
  "local-status-colour": "Use StatusBadge from @/components/ui/patterns/status-badge, not hand-picked colour pairs.",
  "fixed-px-width": "A fixed width of 400px or more overflows a phone. Use w-full with max-w-*, or a responsive width.",
  "click-div": "A clickable <div> is not reachable by keyboard. Use <button> or <Link>.",
  "client-page": 'Make page.tsx a server component and move the interactive part into a "use client" child.',
  "page-missing-metadata": "Export `metadata` (a title) from a server page so the browser tab names the page.",
  "title-brand-suffix":
    "The root layout appends | Matrix to every page title. Write only the page name, e.g. title: \"Leave\".",
  "file-lines": "Do not grow a file over 1,000 lines. Extract into _components/, a hook, or lib/.",
}

/** Remove comments so a rule is not tripped by prose that mentions what it forbids. Keeps line count. */
export function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:\\"'`])\/\/[^\n]*/gm, (_, lead) => lead)
}

const count = (text, re) => (text.match(re) || []).length

const isPage = (f) => /(^|\/)page\.tsx$/.test(f)
const isViewLike = (f) => /(^|\/)(page|view)\.tsx$/.test(f) || /-content\.tsx$/.test(f)
const inComponentsDir = (f) => f.startsWith("components/") || /\/_components\//.test(f)
const startsClient = (text) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(text)

export const RULES = [
  {
    id: "tiny-text",
    count: (text) => count(text, /text-\[(?:9|10|11)px\]/g),
  },
  {
    id: "locale-without-en-ng",
    // a date or time formatted without en-NG or an explicit timeZone. A plain toLocaleString() could be a
    // number, so only toLocaleDateString/TimeString and calls with date options count.
    applies: (f) => f !== "lib/utils/date.ts",
    count: (text) =>
      [...text.matchAll(/\.toLocale(Date|Time)?String\(([^)]*)\)/g)].filter(
        (m) =>
          !/en-NG|timeZone/.test(m[2]) &&
          (m[1] || /\b(year|month|day|hour|minute|second|weekday|dateStyle|timeStyle)\s*:/.test(m[2]))
      ).length,
  },
  {
    id: "raw-img",
    applies: (f) =>
      !/(email|pdf|opengraph-image|twitter-image|birthday|signature|pptx|export)/i.test(f),
    count: (text) => count(text, /<img\b/g),
  },
  {
    id: "window-dialogs",
    count: (text) => count(text, /\bwindow\.(?:confirm|alert|prompt)\(|(?<![\w.$])alert\(/g),
  },
  {
    id: "key-index",
    count: (text) => count(text, /\bkey=\{(?:i|idx|index)\}/g),
  },
  {
    id: "dialog-in-page",
    applies: (f) => isViewLike(f) && !inComponentsDir(f),
    count: (text) => count(text, /<DialogContent\b/g),
  },
  {
    id: "explicit-any",
    count: (text) => count(text, /:\s*any\b|\bas any\b|<any>|\bany\[\]/g),
  },
  {
    id: "eslint-disable",
    raw: true,
    count: (text) => count(text, /eslint-disable/g),
  },
  {
    id: "select-star",
    count: (text) => count(text, /\.select\(\s*(["'`])\*\1/g),
  },
  {
    id: "inline-query-key",
    count: (text) => count(text, /queryKey:\s*\[\s*["'`]/g),
  },
  {
    id: "dark-color-override",
    count: (text) => count(text, /\bdark:(?:bg|text|border)-/g),
  },
  {
    id: "local-status-colour",
    applies: (f) => !/status-badge/.test(f),
    count: (text) =>
      count(text, /\bbg-(?:green|red|amber|yellow|blue|emerald|rose|orange)-100\s+text-/g),
  },
  {
    id: "fixed-px-width",
    count: (text) =>
      [...text.matchAll(/(?<![:\w-])(?:w|min-w)-\[(\d{3,4})px\]/g)].filter((m) => Number(m[1]) >= 400).length,
  },
  {
    id: "click-div",
    count: (text) => count(text, /<div\b[^>\n]*\sonClick=/g),
  },
  {
    id: "client-page",
    applies: isPage,
    raw: true,
    count: (text) => (startsClient(text) ? 1 : 0),
  },
  {
    id: "page-missing-metadata",
    applies: isPage,
    raw: true,
    count: (text) => {
      if (startsClient(text)) return 0 // a client page cannot export metadata; client-page covers it
      if (/export\s+\{\s*default\b/.test(text)) return 0 // re-export of another route's page
      if (/\bredirect\s*\(/.test(text) && text.split("\n").length < 40) return 0
      return /export\s+(?:const\s+metadata\b|(?:async\s+)?function\s+generateMetadata\b)/.test(text) ? 0 : 1
    },
  },
  {
    id: "title-brand-suffix",
    applies: (f) => f.startsWith("app/") && f !== "app/layout.tsx",
    count: (text) => count(text, /\btitle:\s*["'`][^"'`\n]*\|\s*(?:Matrix|ACOB)[^"'`\n]*["'`]/g),
  },
  {
    id: "file-lines",
    raw: true,
    // Only files already over the limit count, by their length, so growing one is a violation.
    count: (text) => {
      const lines = text.split("\n").length
      return lines > 1000 ? lines : 0
    },
  },
]

for (const rule of RULES) rule.hint = HINTS[rule.id]

/** Counts per rule for one file. Only rules with a non-zero count are returned. */
export function countFile(file, text) {
  const stripped = stripComments(text)
  const out = {}
  for (const rule of RULES) {
    if (rule.applies && !rule.applies(file)) continue
    const n = rule.count(rule.raw ? text : stripped)
    if (n > 0) out[rule.id] = n
  }
  return out
}
