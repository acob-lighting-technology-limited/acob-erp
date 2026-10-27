import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { countFile, stripComments } from "../ratchet-rules.mjs"

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "ratchet.mjs")

test("a rule is not tripped by a comment that mentions what it forbids", () => {
  const text = [
    "// do not use text-[10px] here",
    "/* key={index} and window.confirm( are banned */",
    "const a = 1",
  ].join("\n")
  assert.deepEqual(countFile("components/x.tsx", text), {})
})

test("urls inside strings survive comment stripping", () => {
  assert.ok(stripComments('const u = "https://example.com/text-[10px]"').includes("https://example.com"))
})

test("tiny-text counts 9, 10 and 11px but not 12px", () => {
  const c = countFile("components/x.tsx", '<p className="text-[10px] text-[11px] text-[12px] text-[9px]" />')
  assert.equal(c["tiny-text"], 3)
})

test("locale-without-en-ng flags bare and wrong-locale calls only", () => {
  const text = [
    "a.toLocaleString()",
    'a.toLocaleDateString("en-US")',
    'a.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" })',
    "a.toLocaleTimeString()",
  ].join("\n")
  assert.equal(countFile("lib/x.ts", text)["locale-without-en-ng"], 3)
})

test("raw-img ignores email, pdf and og renderers", () => {
  assert.equal(countFile("components/card.tsx", "<img src={x} />")["raw-img"], 1)
  assert.equal(countFile("lib/email-templates/welcome.tsx", "<img src={x} />")["raw-img"], undefined)
  assert.equal(countFile("app/opengraph-image.tsx", "<img src={x} />")["raw-img"], undefined)
})

test("window-dialogs catches confirm, alert and prompt on window, and bare alert", () => {
  const text = "window.confirm('x'); window.alert('y'); alert('z'); window.prompt('p'); confirm('ok'); notify.alert('n')"
  assert.equal(countFile("components/x.tsx", text)["window-dialogs"], 4)
})

test("key-index catches i, idx and index only", () => {
  const c = countFile("components/x.tsx", "<a key={i}/><a key={idx}/><a key={index}/><a key={item.id}/>")
  assert.equal(c["key-index"], 3)
})

test("dialog-in-page applies to page, view and *-content files outside _components", () => {
  const dialog = "<DialogContent className='x'>"
  assert.equal(countFile("app/admin/hr/view.tsx", dialog)["dialog-in-page"], 1)
  assert.equal(countFile("app/admin/hr/hr-content.tsx", dialog)["dialog-in-page"], 1)
  assert.equal(countFile("app/admin/hr/_components/hr-dialog.tsx", dialog)["dialog-in-page"], undefined)
  assert.equal(countFile("components/hr/dialog.tsx", dialog)["dialog-in-page"], undefined)
})

test("explicit-any counts annotations and casts", () => {
  const c = countFile("lib/x.ts", "const a: any = 1; const b = c as any; const d: any[] = []; const e = unknown")
  assert.equal(c["explicit-any"], 3)
})

test("eslint-disable is counted even though it is a comment", () => {
  assert.equal(countFile("lib/x.ts", "// eslint-disable-next-line no-console\nconsole.log(1)")["eslint-disable"], 1)
})

test("select-star only matches select with a lone star", () => {
  const c = countFile("app/api/x/route.ts", ".select('*') .select(\"*\") .select(`*`) .select('id, *') .select('id')")
  assert.equal(c["select-star"], 3)
})

test("inline-query-key flags literal keys, not QUERY_KEYS", () => {
  const c = countFile("components/x.tsx", 'useQuery({ queryKey: ["tasks"] }) useQuery({ queryKey: QUERY_KEYS.tasks })')
  assert.equal(c["inline-query-key"], 1)
})

test("local-status-colour skips the StatusBadge component itself", () => {
  const text = '"bg-green-100 text-green-700"'
  assert.equal(countFile("components/x.tsx", text)["local-status-colour"], 1)
  assert.equal(countFile("components/ui/patterns/status-badge.tsx", text)["local-status-colour"], undefined)
})

test("fixed-px-width ignores widths under 400px and responsive-prefixed ones", () => {
  const c = countFile("components/x.tsx", '"w-[480px] min-w-[600px] w-[200px] sm:w-[500px] max-w-[700px]"')
  assert.equal(c["fixed-px-width"], 2)
})

test("click-div flags a clickable div on one line", () => {
  assert.equal(countFile("components/x.tsx", "<div className='a' onClick={go}>")["click-div"], 1)
  assert.equal(countFile("components/x.tsx", "<button onClick={go}>")["click-div"], undefined)
})

test("client-page and page-missing-metadata only apply to page.tsx and agree with each other", () => {
  const client = '"use client"\nexport default function P() { return null }'
  assert.equal(countFile("app/a/page.tsx", client)["client-page"], 1)
  assert.equal(countFile("app/a/page.tsx", client)["page-missing-metadata"], undefined)
  assert.equal(countFile("app/a/view.tsx", client)["client-page"], undefined)

  const server = "export default function P() { return null }"
  assert.equal(countFile("app/a/page.tsx", server)["page-missing-metadata"], 1)

  const withMeta = 'export const metadata = { title: "A" }\nexport default function P() { return null }'
  assert.equal(countFile("app/a/page.tsx", withMeta)["page-missing-metadata"], undefined)

  const withGen = "export async function generateMetadata() { return {} }\nexport default function P() { return null }"
  assert.equal(countFile("app/a/page.tsx", withGen)["page-missing-metadata"], undefined)

  assert.equal(countFile("app/a/page.tsx", 'export { default } from "../b/page"')["page-missing-metadata"], undefined)
  assert.equal(countFile("app/a/page.tsx", 'import { redirect } from "next/navigation"\nexport default function P() { redirect("/x") }')["page-missing-metadata"], undefined)
})

test("file-lines counts only files over 1000 lines, by length", () => {
  assert.equal(countFile("lib/x.ts", "a\n".repeat(500))["file-lines"], undefined)
  assert.equal(countFile("lib/x.ts", "a\n".repeat(1500))["file-lines"], 1501)
})

test("title-brand-suffix flags a hand-written brand suffix in app/ but not a plain title", () => {
  const bad = 'export const metadata = { title: "Leave | Matrix" }'
  const longBad = 'export const metadata = { title: "Leave | ACOB Lighting Technology Limited" }'
  const good = 'export const metadata = { title: "Leave" }'
  assert.equal(countFile("app/hr/leave/page.tsx", bad)["title-brand-suffix"], 1)
  assert.equal(countFile("app/hr/leave/page.tsx", longBad)["title-brand-suffix"], 1)
  assert.equal(countFile("app/hr/leave/page.tsx", good)["title-brand-suffix"], undefined)
  assert.equal(countFile("app/layout.tsx", 'title: "Matrix | Matrix"')["title-brand-suffix"], undefined)
  assert.equal(countFile("components/x.tsx", bad)["title-brand-suffix"], undefined)
})

// --- the CLI, end to end, against a throwaway project ---------------------------------------

function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ratchet-"))
  fs.mkdirSync(path.join(dir, "scripts", "ui"), { recursive: true })
  const write = (rel, text) => {
    const full = path.join(dir, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, text)
  }
  for (const [rel, text] of Object.entries(files)) write(rel, text)
  const run = (...flags) => spawnSync(process.execPath, [SCRIPT, ...flags], { cwd: dir, encoding: "utf8" })
  return { dir, write, run }
}

test("cli: fails when a count rises, passes when it falls, and refuses to update upward", () => {
  const p = project({ "components/a.tsx": '<p className="text-[10px] text-[11px]" />' })
  try {
    assert.equal(p.run().status, 1, "no baseline yet")
    assert.equal(p.run("--update", "--allow-increase").status, 0)
    assert.equal(p.run().status, 0, "unchanged tree passes")

    p.write("components/a.tsx", '<p className="text-[10px] text-[11px] text-[9px]" />')
    const rose = p.run()
    assert.equal(rose.status, 1)
    assert.match(rose.stderr, /components\/a\.tsx\s+2 -> 3/)
    assert.equal(p.run("--update").status, 1, "update refuses while a count is above the baseline")

    p.write("components/a.tsx", '<p className="text-[10px]" />')
    const better = p.run()
    assert.equal(better.status, 0)
    assert.match(better.stdout, /1 fewer violation/)
    assert.equal(p.run("--update").status, 0, "an improvement can be locked in")
    assert.equal(p.run().stdout.includes("fewer"), false)
  } finally {
    fs.rmSync(p.dir, { recursive: true, force: true })
  }
})

test("cli: a new file cannot pay for an old one, and a brand new violation fails", () => {
  const p = project({ "components/a.tsx": '<p className="text-[10px]" />', "components/b.tsx": "export const b = 1" })
  try {
    p.run("--update", "--allow-increase")
    // fixing a.tsx must not give b.tsx room to add its own
    p.write("components/a.tsx", "export const a = 1")
    p.write("components/b.tsx", '<p className="text-[10px]" />')
    const r = p.run()
    assert.equal(r.status, 1)
    assert.match(r.stderr, /components\/b\.tsx\s+0 -> 1/)
  } finally {
    fs.rmSync(p.dir, { recursive: true, force: true })
  }
})
