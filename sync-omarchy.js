#!/usr/bin/env node
// Refresh Omarchy rows in commands.json from the live CLI catalog.
//
//     node sync-omarchy.js
//
// Curated Linux/Arch rows stay put. Overlapping Omarchy rows keep their
// titles, tags, examples, flags, and related links; missing routes are added.

const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

function loadModel() {
  const src = fs.readFileSync(path.join(__dirname, "Model.js"), "utf8")
    .replace(/^\s*\.pragma\s+library\s*$/m, "")
  const names = []
  for (const m of src.matchAll(/^(?:function|var)\s+([A-Za-z_$][\w$]*)/gm)) names.push(m[1])
  return new Function(src + "\nreturn {" + names.join(", ") + "}")()
}

const M = loadModel()
const libPath = path.join(__dirname, "commands.json")
const raw = JSON.parse(fs.readFileSync(libPath, "utf8"))
const base = Array.isArray(raw) ? raw : (raw.commands || [])

let payload = ""
try {
  payload = execSync("omarchy commands --json", { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 })
} catch (err) {
  console.error("Failed to run `omarchy commands --json`:", err.message)
  process.exit(1)
}

const live = M.fromOmarchyCommandsJson(payload)
if (!live.length) {
  console.error("Live catalog parsed to zero commands; refusing to write.")
  process.exit(1)
}

const before = M.normalizeLibrary(base)
const merged = M.enrichLibrary(M.mergeLibraries(before, live))
const beforeOmarchy = before.filter(e => e.sources.includes("omarchy")).length
const afterOmarchy = merged.filter(e => e.sources.includes("omarchy")).length
const withFlags = merged.filter(e => e.flags && e.flags.length).length
const withRelated = merged.filter(e => e.related && e.related.length).length

fs.writeFileSync(libPath, JSON.stringify(merged, null, 2) + "\n")
console.log(`Omarchy rows: ${beforeOmarchy} → ${afterOmarchy} (live ${live.length})`)
console.log(`Total library: ${before.length} → ${merged.length}`)
console.log(`With flags: ${withFlags} · with related: ${withRelated}`)
console.log(`Wrote ${libPath}`)
