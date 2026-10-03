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
check("idle browses topics", idle.meta.browsingTopics, true)
check("idle topics include files", idle.results.some(r => r.topicId === "files"), true)

const used = M.recordUse({}, "rm", 1_700_000_000_000)
check("frecency records a use", used.rm.n, 1)
const inFiles = M.search(library, "", M.defaultSources(), used, 10, "files")
check("topic files lists rm", inFiles.results.some(r => r.id === "rm"), true)
check("topic meta names the topic", inFiles.meta.topicLabel, "Files & folders")
check("used marker inside topic", inFiles.results.find(r => r.id === "rm").used, true)

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

check("footer mentions copy example", M.footerHints(true, {}).join(" ").includes("copy example"), true)
check("footer without selection", M.footerHints(false, {}), ["esc close"])
check("footer topics mode", M.footerHints(true, { browsingTopics: true })[0], "⏎ open topic")
check("footer did-you-mean mode", M.footerHints(true, { didYouMean: true }).join(" ").includes("refine"), true)
check("markUsed flips the bullet", M.markUsed([{ id: "rm", used: false, command: "rm", title: "t", summary: "", sources: ["linux"], danger: null, score: 1 }], "rm")[0].used, true)
check("indexOfId", M.indexOfId([{ id: "a" }, { id: "b" }], "b"), 1)

const livePayload = JSON.stringify({
  ok: true,
  commands: [
    {
      route: "omarchy theme set",
      binary: "omarchy-theme-set",
      group: "theme",
      name: "set",
      summary: "Apply an Omarchy theme",
      requires_sudo: false,
      hidden: false,
      args: "<theme-name>",
      examples: ["omarchy theme set \"Tokyo Night\""],
      aliases: []
    },
    {
      route: "omarchy audio input mute",
      binary: "omarchy-audio-input-mute",
      group: "audio",
      name: "input mute",
      summary: "Toggle microphone mute",
      requires_sudo: false,
      hidden: false,
      args: "",
      examples: [],
      aliases: []
    },
    {
      route: "omarchy audio output volume",
      binary: "omarchy-audio-output-volume",
      group: "audio",
      name: "output volume",
      summary: "Set output volume",
      requires_sudo: false,
      hidden: false,
      args: "",
      examples: [],
      aliases: []
    },
    {
      route: "omarchy channel set",
      binary: "omarchy-channel-set",
      group: "channel",
      name: "set",
      summary: "Set the Omarchy package channel.",
      requires_sudo: true,
      hidden: false,
      args: "<stable|rc|edge|dev>",
      examples: [],
      aliases: []
    },
    {
      route: "omarchy hidden",
      binary: "omarchy-hidden",
      group: "dev",
      name: "hidden",
      summary: "Should be skipped",
      hidden: true,
      examples: [],
      aliases: []
    }
  ]
})
const live = M.fromOmarchyCommandsJson(livePayload)
check("live catalog skips hidden", live.map(e => e.id).includes("omarchy-hidden"), false)
check("live catalog ids use binary", live.map(e => e.id).sort(), [
  "omarchy-audio-input-mute",
  "omarchy-audio-output-volume",
  "omarchy-channel-set",
  "omarchy-theme-set"
])
check("live mute has a run example", M.copyTarget(live.find(e => e.id === "omarchy-audio-input-mute"), 0), "omarchy audio input mute")
check("sudo becomes medium danger", live.find(e => e.id === "omarchy-channel-set").danger, "medium")
check("live tags include group", live.find(e => e.id === "omarchy-audio-input-mute").tags.includes("audio"), true)

const merged = M.mergeLibraries(library, live)
const theme = merged.find(e => e.command === "omarchy theme set")
check("merge keeps curated id", theme.id, "omarchy-theme-set")
check("merge keeps curated title", theme.title, "Apply a theme")
check("merge keeps curated examples", theme.examples[0].cmd, "omarchy theme set catppuccin")
check("merge adds missing live rows", merged.some(e => e.id === "omarchy-audio-input-mute"), true)
check("merge leaves linux rows alone", merged.filter(e => e.sources.includes("linux")).length, library.filter(e => e.sources.includes("linux")).length)
check("empty live catalog is a no-op", M.mergeLibraries(library, []).length, library.length)
check("bad omarchy json yields empty", M.fromOmarchyCommandsJson("not-json"), [])

const mute = live.find(e => e.id === "omarchy-audio-input-mute")
check("mute intent includes mic", mute.tags.includes("mic"), true)
check("mute intent includes mute mic phrase", mute.tags.includes("mute mic"), true)
check("channel set parses args into flags", live.find(e => e.id === "omarchy-channel-set").flags.some(f => f.flag === "<stable|rc|edge|dev>"), true)
check("theme set parses args into flags", live.find(e => e.id === "omarchy-theme-set").flags.some(f => f.flag === "<theme-name>"), true)

const agentLive = M.fromOmarchyCommandsJson(JSON.stringify({
  commands: [{
    route: "omarchy agent",
    binary: "omarchy-agent",
    group: "agent",
    name: "",
    summary: "Launch the default coding agent",
    args: "[--inline] [--pick]",
    examples: ["omarchy agent"],
    aliases: [],
    hidden: false,
    requires_sudo: false
  }]
}))[0]
check("parses long flags from args", agentLive.flags.map(f => f.flag).sort(), ["--inline", "--pick"])

const enriched = M.enrichLibrary(M.mergeLibraries(library, live))
const muteEnriched = enriched.find(e => e.command === "omarchy audio input mute")
check("enrich keeps mute intent tags", muteEnriched.tags.includes("microphone"), true)
check("enrich suggests omarchy related", muteEnriched.related.length > 0, true)
check("mute mic ranks audio input mute first", M.search(enriched, "mute mic", { linux: false, arch: false, omarchy: true }, {}, 5).results[0].command, "omarchy audio input mute")

const linuxFlags = M.enrichLibrary(M.normalizeLibrary([{
  id: "ps", command: "ps", title: "List processes", summary: "Show processes.",
  sources: ["linux"], tags: ["process"], examples: [{ label: "All", cmd: "ps aux" }],
  flags: [], related: [], man: "ps"
}]))
check("common flags fill empty linux row", linuxFlags[0].flags.some(f => f.flag === "aux"), true)
check("common related fill empty linux row", linuxFlags[0].related.includes("pgrep"), true)
check("search synonym folder~directory", M.termVariants("folder").includes("directory"), true)

const misspelled = M.search(library, "rmdr", M.defaultSources(), {}, 10)
check("did you mean on typo", misspelled.meta.didYouMean, true)
check("did you mean suggests rmdir", misspelled.results.some(r => r.id === "rmdir"), true)
check("exact match is not did-you-mean", M.search(library, "rm", M.defaultSources(), {}, 10).meta.didYouMean, false)
check("edit distance close", M.editDistance("rmdir", "rmdr") <= 2, true)

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
