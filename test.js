#!/usr/bin/env node
// Model.js unit tests.
//
//     node test.js

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
let checks = 0
const failures = []

function check(label, got, want) {
  checks += 1
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g !== w) failures.push(label + "\n      got  " + g + "\n      want " + w)
}

const library = M.normalizeLibrary([
  {
    id: "rm",
    command: "rm",
    title: "Delete files and folders",
    summary: "Remove files or directories.",
    sources: ["linux"],
    tags: ["delete", "remove", "folders", "files"],
    danger: "high",
    examples: [
      { label: "Delete a file", cmd: "rm file.txt" },
      { label: "Delete a folder", cmd: "rm -rf folder/" }
    ],
    flags: [{ flag: "-r", meaning: "Recursive" }],
    related: ["rmdir", "find"],
    man: "rm",
    starter: true
  },
  {
    id: "rmdir",
    command: "rmdir",
    title: "Delete an empty folder",
    summary: "Remove an empty directory.",
    sources: ["linux"],
    tags: ["delete", "folder"],
    examples: [{ label: "Remove empty folder", cmd: "rmdir old" }],
    related: ["rm"],
    man: "rmdir"
  },
  {
    id: "ip-addr",
    command: "ip addr",
    title: "Show network addresses",
    summary: "List IP addresses on every interface.",
    sources: ["linux"],
    tags: ["ip", "network", "address", "show"],
    examples: [{ label: "Show all addresses", cmd: "ip addr" }],
    related: ["hostname"],
    man: "ip"
  },
  {
    id: "pacman-install",
    command: "pacman -S",
    title: "Install a package",
    summary: "Install packages from the Arch repositories.",
    sources: ["arch"],
    tags: ["install", "package", "software"],
    examples: [{ label: "Install neovim", cmd: "sudo pacman -S neovim" }],
    related: ["pacman-remove"],
    man: "pacman"
  },
  {
    id: "omarchy-theme-set",
    command: "omarchy theme set",
    title: "Apply a theme",
    summary: "Switch the Omarchy theme by name.",
    sources: ["omarchy"],
    tags: ["theme", "colors", "appearance"],
    examples: [{ label: "Set catppuccin", cmd: "omarchy theme set catppuccin" }],
    related: ["omarchy-theme-list"],
    starter: true
  },
  {
    id: "bad",
    command: "",
    title: "Nope",
    sources: ["linux"]
  }
])

check("drops incomplete records", library.map(e => e.id), ["rm", "rmdir", "ip-addr", "pacman-install", "omarchy-theme-set"])

check("default sources are all on", M.defaultSources(), { linux: true, arch: true, omarchy: true })
check("toggle turns linux off", M.toggleSource(M.defaultSources(), "linux").linux, false)

const all = M.search(library, "delete folders", M.defaultSources(), {}, 10)
check("intent search finds rm first", all.results[0].id, "rm")
check("intent search also finds rmdir", all.results.some(r => r.id === "rmdir"), true)
check("copy target is first example", M.copyTarget(library[0], 0), "rm file.txt")
check("copy target respects example index", M.copyTarget(library[0], 1), "rm -rf folder/")

const archOnly = M.search(library, "install", { linux: false, arch: true, omarchy: false }, {}, 10)
check("arch pill filters to pacman", archOnly.results.map(r => r.id), ["pacman-install"])

const none = M.search(library, "rm", { linux: false, arch: false, omarchy: false }, {}, 10)
check("no sources yields emptySources", none.meta.emptySources, true)

const idle = M.search(library, "", M.defaultSources(), {}, 10)
check("idle starters rank first", idle.results[0].id, "rm")

const used = M.recordUse({}, "rm", 1_700_000_000_000)
check("frecency records a use", used.rm.n, 1)
const boosted = M.search(library, "", M.defaultSources(), used, 10)
check("used starter still first", boosted.results[0].id, "rm")
check("used marker on result", boosted.results[0].used, true)

const usedIp = M.recordUse({}, "ip-addr", 1_700_000_000_000)
const ranked = M.search(library, "show", M.defaultSources(), usedIp, 10)
check("most-used solid match sorts first", ranked.results[0].id, "ip-addr")

const heavilyUsedSudo = {}
for (let i = 0; i < 40; i++) Object.assign(heavilyUsedSudo, M.recordUse(heavilyUsedSudo, "rm", 1_700_000_000_000 + i))
const lib2 = M.normalizeLibrary([
  {
    id: "rm", command: "rm", title: "Delete", summary: "Remove.", sources: ["linux"],
    tags: ["delete"], examples: [{ label: "x", cmd: "sudo pacman -S neovim" }], flags: [], related: [], man: "rm"
  },
  {
    id: "pacman-S", command: "pacman -S", title: "Install packages", summary: "Install.",
    sources: ["arch"], tags: ["install", "pacman"], examples: [{ label: "Install", cmd: "sudo pacman -S x" }],
    flags: [], related: [], man: "pacman"
  }
])
const pacSearch = M.search(lib2, "pacman", M.defaultSources(), heavilyUsedSudo, 5)
check("strong match beats heavily-used weak match", pacSearch.results[0].id, "pacman-S")

check("findById", M.findById(library, "ip-addr").command, "ip addr")
check("highlight wraps a match", M.highlightHtml("show my ip", "ip", "#ff0").includes('<font color="#ff0">ip</font>'), true)
check("source badges", M.sourceBadges(library[0]), ["Linux"])
check("danger label", M.dangerLabel("high"), "Dangerous")
check("related resolves by command/id", M.relatedEntries(library, library[0], M.defaultSources(), 4).map(e => e.id).includes("rmdir"), true)
check("related ignores source pills", M.relatedEntries(library, library[0], { linux: false, arch: false, omarchy: false }, 4).map(e => e.id).includes("rmdir"), true)
const pacman = library.find(e => e.id === "pacman-install")
check("openSourcesFor turns arch on", M.openSourcesFor(pacman, { linux: true, arch: false, omarchy: false }), { linux: true, arch: true, omarchy: false })
check("source color uses theme", M.sourceColor("linux", { blue: "#112233" }, "#000"), "#112233")
check("source color falls back", M.sourceColor("arch", {}, "#abc"), "#abc")

check("parse and serialize sources round-trip",
  M.parseSavedSources(M.serializeSources({ linux: true, arch: false, omarchy: true })),
  { linux: true, arch: false, omarchy: true })

check("parse frecency", M.parseFrecency('{"used":{"rm":{"n":2,"t":9}}}').rm.n, 2)

check("footer mentions copy example", M.footerHints(true).join(" ").includes("copy example"), true)
check("footer without selection", M.footerHints(false), ["esc close"])
check("markUsed flips the bullet", M.markUsed([{ id: "rm", used: false, command: "rm", title: "t", summary: "", sources: ["linux"], danger: null, score: 1 }], "rm")[0].used, true)
check("indexOfId", M.indexOfId([{ id: "a" }, { id: "b" }], "b"), 1)

if (fs.existsSync(path.join(__dirname, "commands.json"))) {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "commands.json"), "utf8"))
  const full = M.normalizeLibrary(Array.isArray(raw) ? raw : raw.commands)
  check("library has commands", full.length > 100, true)
  const by = { linux: 0, arch: 0, omarchy: 0 }
  for (const e of full) for (const s of e.sources) by[s] += 1
  check("has linux entries", by.linux > 50, true)
  check("has arch entries", by.arch > 20, true)
  check("has omarchy entries", by.omarchy > 20, true)

  const del = M.search(full, "delete folders", M.defaultSources(), {}, 5)
  check("library matches delete folders", del.results.length > 0, true)
  const ip = M.search(full, "show my ip", M.defaultSources(), {}, 5)
  check("library matches show my ip", ip.results.length > 0, true)
  const theme = M.search(full, "theme", { linux: false, arch: false, omarchy: true }, {}, 5)
  check("omarchy theme search", theme.results.some(r => r.command.includes("theme")), true)
}

if (failures.length) {
  console.error(failures.join("\n\n"))
  console.error(`\n${failures.length} failed / ${checks} checks`)
  process.exit(1)
}
console.log(`ok — ${checks} checks`)
