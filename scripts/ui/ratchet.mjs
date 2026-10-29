#!/usr/bin/env node
// UI ratchet: per-file counts of known-bad patterns may only go down.
//
//   node scripts/ui/ratchet.mjs                  check against the baseline (exit 1 if any count rose)
//   node scripts/ui/ratchet.mjs --update         lock in improvements (refuses if any count rose)
//   node scripts/ui/ratchet.mjs --update --allow-increase   accept a rise, e.g. when the baseline is first built
//   node scripts/ui/ratchet.mjs --summary        totals per rule
//
// The baseline is per file, not per total, so fixing one file cannot pay for breaking another.
import fs from "node:fs/promises"
import path from "node:path"
import { RULES, countFile } from "./ratchet-rules.mjs"

const ROOT = process.cwd()
const BASELINE_PATH = path.join(ROOT, "scripts", "ui", "ratchet-baseline.json")
const SCAN_DIRS = ["app", "components", "lib", "hooks", "providers"]
const SKIP_DIR = new Set(["node_modules", ".next", "__tests__"])

const args = new Set(process.argv.slice(2))
const toPosix = (p) => p.split(path.sep).join("/")

async function walk(dir, out) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!SKIP_DIR.has(e.name)) await walk(full, out)
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts")) {
      out.push(full)
    }
  }
}

async function measure() {
  const files = []
  for (const d of SCAN_DIRS) await walk(path.join(ROOT, d), files)
  const counts = {} // rule -> file -> n
  for (const rule of RULES) counts[rule.id] = {}
  for (const f of files) {
    const rel = toPosix(path.relative(ROOT, f))
    const text = await fs.readFile(f, "utf8")
    for (const [id, n] of Object.entries(countFile(rel, text))) counts[id][rel] = n
  }
  return counts
}

function sortObject(o) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
}

async function readBaseline() {
  try {
    return JSON.parse(await fs.readFile(BASELINE_PATH, "utf8")).rules || {}
  } catch {
    return null
  }
}

function compare(current, baseline) {
  const rose = []
  const improved = []
  for (const rule of RULES) {
    const cur = current[rule.id] || {}
    const base = baseline[rule.id] || {}
    for (const [file, n] of Object.entries(cur)) {
      const was = base[file] || 0
      if (n > was) rose.push({ rule: rule.id, file, was, now: n, hint: rule.hint })
      else if (n < was) improved.push({ rule: rule.id, file, was, now: n })
    }
    for (const [file, was] of Object.entries(base)) {
      if (!(file in cur)) improved.push({ rule: rule.id, file, was, now: 0 })
    }
  }
  return { rose, improved }
}

const total = (m) => Object.values(m).reduce((a, b) => a + b, 0)

async function main() {
  const current = await measure()

  if (args.has("--summary")) {
    for (const rule of RULES) {
      const files = Object.keys(current[rule.id]).length
      console.log(`${rule.id.padEnd(24)} ${String(total(current[rule.id])).padStart(6)} in ${String(files).padStart(4)} files`)
    }
    return
  }

  const baseline = await readBaseline()

  if (args.has("--update")) {
    if (baseline && !args.has("--allow-increase")) {
      const { rose } = compare(current, baseline)
      if (rose.length) {
        console.error(`Refusing to update: ${rose.length} count(s) rose. Fix them, or pass --allow-increase on purpose.`)
        for (const r of rose.slice(0, 20)) console.error(`  ${r.rule}  ${r.file}  ${r.was} -> ${r.now}`)
        process.exit(1)
      }
    }
    const rules = {}
    for (const rule of RULES) rules[rule.id] = sortObject(current[rule.id])
    await fs.writeFile(BASELINE_PATH, JSON.stringify({ version: 1, rules }, null, 2) + "\n", "utf8")
    console.log(`Baseline written: ${toPosix(path.relative(ROOT, BASELINE_PATH))}`)
    for (const rule of RULES) console.log(`  ${rule.id.padEnd(24)} ${total(current[rule.id])}`)
    return
  }

  if (!baseline) {
    console.error("No baseline found. Run: node scripts/ui/ratchet.mjs --update --allow-increase")
    process.exit(1)
  }

  const { rose, improved } = compare(current, baseline)
  if (rose.length) {
    console.error(`UI ratchet failed: ${rose.length} count(s) rose above the baseline.\n`)
    const byRule = new Map()
    for (const r of rose) byRule.set(r.rule, [...(byRule.get(r.rule) || []), r])
    for (const [rule, items] of byRule) {
      console.error(`${rule}: ${items[0].hint}`)
      for (const r of items) console.error(`  ${r.file}  ${r.was} -> ${r.now}`)
      console.error("")
    }
    console.error("Fix the new occurrences. The baseline only moves down: see scripts/ui/README.md.")
    process.exit(1)
  }

  const fixed = improved.reduce((a, r) => a + (r.was - r.now), 0)
  console.log(`UI ratchet ok.${fixed ? ` ${fixed} fewer violation(s) than the baseline: run "npm run ui:ratchet:update" and commit it.` : ""}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
