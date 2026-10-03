.pragma library

// Pure search and ranking for Command Lookup. Nothing here touches a file or
// a window, so `node test.js` covers it.

var SOURCES = ["linux", "arch", "omarchy"]
var MAX_RESULTS = 40
var STARTER_LIMIT = 24
var SUGGESTION_LIMIT = 8

// Empty-query browse: topic rows, then drill-in to matching commands.
var TOPICS = [
  {
    id: "files",
    label: "Files & folders",
    summary: "List, move, copy, delete, and inspect paths",
    tags: ["file", "files", "folder", "folders", "directory", "directories", "path", "disk"],
    commands: ["ls", "eza", "tree", "cd", "pwd", "cp", "mv", "rm", "rmdir", "mkdir", "touch", "find", "fd", "du", "dust", "df", "lsblk", "stat", "file", "trash-put"]
  },
  {
    id: "text",
    label: "Text & search",
    summary: "Read, search, and transform text",
    tags: ["text", "search", "grep", "regex"],
    commands: ["cat", "bat", "less", "head", "tail", "grep", "rg", "sed", "awk", "cut", "sort", "uniq", "wc", "diff", "tee", "xargs"]
  },
  {
    id: "network",
    label: "Network",
    summary: "IP, Wi-Fi, DNS, SSH, and connectivity",
    tags: ["network", "wifi", "wireless", "dns", "ssh", "ip", "internet"],
    commands: ["ip addr", "ip route", "ip link", "ping", "curl", "wget", "nmcli", "nmtui", "ss", "ssh", "scp", "dig", "host", "traceroute", "nmap", "curl ifconfig.me"]
  },
  {
    id: "processes",
    label: "Processes & jobs",
    summary: "See what’s running and stop it",
    tags: ["process", "processes", "pid", "job", "jobs"],
    commands: ["ps", "pgrep", "pkill", "kill", "killall", "top", "htop", "btop", "jobs", "fg", "bg", "nice", "nohup"]
  },
  {
    id: "system",
    label: "System & services",
    summary: "systemd, logs, users, and machine info",
    tags: ["system", "service", "systemd", "log", "logs", "user"],
    commands: ["systemctl status", "systemctl start", "systemctl stop", "systemctl restart", "systemctl enable", "systemctl disable", "systemctl list-units", "journalctl", "loginctl", "hostnamectl", "timedatectl", "dmesg", "coredumpctl", "uname", "fastfetch"]
  },
  {
    id: "packages",
    label: "Packages",
    summary: "Install and update software (pacman, AUR, Omarchy pkg)",
    tags: ["package", "packages", "pacman", "aur", "pkg", "install", "uninstall"],
    commands: ["pacman -S", "pacman -Syu", "pacman -Ss", "pacman -R", "paru", "yay", "paccache"],
    commandPrefixes: ["omarchy pkg ", "pacman "]
  },
  {
    id: "git",
    label: "Git",
    summary: "Everyday version control",
    tags: ["git", "commit", "branch", "repo"],
    commands: ["git status", "git add", "git commit", "git push", "git pull", "git clone", "git diff", "git log", "git branch", "git switch"]
  },
  {
    id: "theme",
    label: "Theme & look",
    summary: "Colors, fonts, backgrounds, and branding",
    tags: ["theme", "appearance", "colors", "font", "fonts", "wallpaper", "background", "look"],
    commandPrefixes: ["omarchy theme ", "omarchy font ", "omarchy branding "]
  },
  {
    id: "capture",
    label: "Capture & share",
    summary: "Screenshots, recording, clipboard, and sharing",
    tags: ["screenshot", "capture", "record", "recording", "clipboard", "share", "qr", "ocr"],
    commands: ["grim", "slurp", "wl-copy", "wl-paste", "notify-send"],
    commandPrefixes: ["omarchy capture ", "omarchy share"]
  },
  {
    id: "desktop",
    label: "Desktop & Omarchy",
    summary: "Bar, toggles, launchers, sessions, and updates",
    tags: ["bar", "toggle", "launch", "menu", "shell", "reminder", "update", "plugin", "plugins"],
    commandPrefixes: ["omarchy toggle ", "omarchy launch ", "omarchy restart ", "omarchy refresh ", "omarchy plugin ", "omarchy system ", "omarchy menu", "omarchy update", "omarchy reminder", "omarchy shell", "hyprctl"]
  }
]

function str(v) {
  return v === undefined || v === null ? "" : String(v)
}

function words(query) {
  return str(query).trim().toLowerCase().split(/\s+/).filter(function(w) { return w })
}

function escapeHtml(text) {
  return str(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

// `text` with every typed word coloured, so a row shows why it matched.
function highlightHtml(text, query, color) {
  var source = str(text)
  var terms = words(query)
  if (!terms.length) return escapeHtml(source)
  var lower = source.toLowerCase()
  var marked = []
  for (var t = 0; t < terms.length; t++) {
    for (var at = lower.indexOf(terms[t]); at !== -1; at = lower.indexOf(terms[t], at + 1)) {
      for (var k = at; k < at + terms[t].length; k++) marked[k] = true
    }
  }
  var out = ""
  var open = false
  for (var i = 0; i < source.length; i++) {
    if (marked[i] && !open) { out += '<font color="' + color + '">'; open = true }
    if (!marked[i] && open) { out += "</font>"; open = false }
    out += escapeHtml(source.charAt(i))
  }
  if (open) out += "</font>"
  return out
}

function defaultSources() {
  return { linux: true, arch: true, omarchy: true }
}

function normalizeSources(raw) {
  var out = defaultSources()
  if (!raw || typeof raw !== "object") return out
  for (var i = 0; i < SOURCES.length; i++) {
    var key = SOURCES[i]
    if (raw[key] === false) out[key] = false
    else if (raw[key] === true) out[key] = true
  }
  return out
}

function anySourceOn(sources) {
  var s = normalizeSources(sources)
  return s.linux || s.arch || s.omarchy
}

function sourceAllowed(entry, sources) {
  var s = normalizeSources(sources)
  var list = entry && entry.sources ? entry.sources : []
  for (var i = 0; i < list.length; i++) {
    if (s[list[i]]) return true
  }
  return false
}

function toggleSource(sources, key) {
  var next = normalizeSources(sources)
  if (SOURCES.indexOf(key) < 0) return next
  next[key] = !next[key]
  return next
}

function sourceLabel(key) {
  if (key === "linux") return "Linux"
  if (key === "arch") return "Arch"
  if (key === "omarchy") return "Omarchy"
  return str(key)
}

function haystack(entry) {
  if (!entry) return ""
  var parts = [
    entry.command, entry.title, entry.summary,
    (entry.tags || []).join(" "),
    (entry.related || []).join(" ")
  ]
  var examples = entry.examples || []
  for (var i = 0; i < examples.length; i++) {
    parts.push(examples[i].label)
    parts.push(examples[i].cmd)
  }
  var flags = entry.flags || []
  for (var f = 0; f < flags.length; f++) {
    parts.push(flags[f].flag)
    parts.push(flags[f].meaning)
  }
  return parts.join(" \n ").toLowerCase()
}

// Query-side synonyms so “mic” hits “microphone”, “folder” hits “directory”, etc.
var SEARCH_SYNONYMS = {
  mic: ["mic", "microphone"],
  microphone: ["mic", "microphone"],
  folder: ["folder", "directory", "dir"],
  folders: ["folders", "directories", "folder", "directory", "dir"],
  directory: ["directory", "folder", "dir"],
  directories: ["directories", "folders", "folder", "directory"],
  dir: ["dir", "directory", "folder"],
  delete: ["delete", "remove"],
  remove: ["remove", "delete"],
  install: ["install", "add"],
  uninstall: ["uninstall", "remove", "delete"],
  package: ["package", "pkg"],
  packages: ["packages", "package", "pkg"],
  wifi: ["wifi", "wireless"],
  screenshot: ["screenshot", "screengrab", "capture"],
  theme: ["theme", "appearance", "colors"],
  mute: ["mute", "unmute", "silent"],
  volume: ["volume", "sound", "audio"],
  brightness: ["brightness", "backlight"],
  update: ["update", "upgrade"],
  upgrade: ["upgrade", "update"],
  process: ["process", "processes", "pid"],
  processes: ["processes", "process"]
}

function termVariants(term) {
  var out = [term]
  if (term.length > 3 && term.charAt(term.length - 1) === "s") out.push(term.slice(0, -1))
  else if (term.length > 2) out.push(term + "s")
  var syn = SEARCH_SYNONYMS[term]
  if (syn) {
    for (var i = 0; i < syn.length; i++) {
      if (out.indexOf(syn[i]) < 0) out.push(syn[i])
    }
  }
  return out
}

function hayContains(hay, term) {
  var variants = termVariants(term)
  for (var i = 0; i < variants.length; i++) {
    if (hay.indexOf(variants[i]) >= 0) return true
  }
  return false
}

function matchesAll(entry, terms) {
  if (!terms.length) return true
  var hay = haystack(entry)
  for (var i = 0; i < terms.length; i++) {
    if (!hayContains(hay, terms[i])) return false
  }
  return true
}

// Relevance only — frecency is applied separately so most-used always sorts first.
function relevanceScore(entry, terms) {
  var score = 0
  var cmd = str(entry.command).toLowerCase()
  var title = str(entry.title).toLowerCase()
  var tags = (entry.tags || []).map(function(t) { return str(t).toLowerCase() })

  if (!terms.length) {
    if (entry.starter) score += 500
    score += Math.max(0, 50 - str(entry.id).length)
    return score
  }

  for (var i = 0; i < terms.length; i++) {
    var term = terms[i]
    if (cmd === term) score += 400
    else if (cmd.indexOf(term) === 0) score += 220
    else if (cmd.indexOf(term) >= 0) score += 120

    if (title.indexOf(term) === 0) score += 90
    else if (title.indexOf(term) >= 0) score += 50

    // Synonyms count for tags only, so “mic” can still boost a microphone tag
    // without reshuffling title/example ranking for every plural/synonym hit.
    var tagHit = 0
    var tagVariants = termVariants(term)
    for (var t = 0; t < tags.length; t++) {
      for (var tv = 0; tv < tagVariants.length; tv++) {
        if (tags[t] === tagVariants[tv]) tagHit = Math.max(tagHit, 140)
        else if (tags[t].indexOf(tagVariants[tv]) >= 0) tagHit = Math.max(tagHit, 70)
      }
    }
    score += tagHit

    var summary = str(entry.summary).toLowerCase()
    if (summary.indexOf(term) >= 0) score += 25

    var examples = entry.examples || []
    for (var e = 0; e < examples.length; e++) {
      var label = str(examples[e].label).toLowerCase()
      var exCmd = str(examples[e].cmd).toLowerCase()
      if (label.indexOf(term) >= 0) score += 35
      if (exCmd.indexOf(term) >= 0) score += 30
    }
  }

  var joined = terms.join(" ")
  if (joined.length > 2) {
    if (title.indexOf(joined) >= 0) score += 80
    if (tags.join(" ").indexOf(joined) >= 0) score += 60
  }

  if (entry.danger === "high") score -= 5
  return score
}

function frecencyBoost(id, frecency) {
  if (!frecency || !frecency[id]) return 0
  var rec = frecency[id]
  var n = Number(rec.n) || 0
  var t = Number(rec.t) || 0
  if (n <= 0) return 0
  var ageDays = t > 0 ? Math.max(0, (Date.now() - t) / 86400000) : 30
  var recency = Math.max(0.2, 1 - ageDays / 60)
  return Math.min(1000, Math.round(Math.log(1 + n) * 80 * recency) + n * 10)
}

// Theme colour names for each source pill / badge.
var SOURCE_COLORS = { linux: "blue", arch: "magenta", omarchy: "green" }

function themeColors(raw) {
  var colors = {}
  var lines = str(raw).split("\n")
  for (var i = 0; i < lines.length; i++) {
    var match = lines[i].match(/^\s*([A-Za-z0-9_-]+)\s*=\s*["']?(#[0-9A-Fa-f]{6})\b/)
    if (match) colors[match[1]] = match[2]
  }
  return colors
}

function sourceColor(key, colors, fallback) {
  var name = SOURCE_COLORS[key]
  return (name && colors && colors[name]) || fallback
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null
  var id = str(raw.id).trim()
  var command = str(raw.command).trim()
  var title = str(raw.title).trim()
  if (!id || !command || !title) return null
  var sources = []
  var list = raw.sources || []
  for (var i = 0; i < list.length; i++) {
    if (SOURCES.indexOf(list[i]) >= 0 && sources.indexOf(list[i]) < 0) sources.push(list[i])
  }
  if (!sources.length) return null
  return {
    id: id,
    command: command,
    title: title,
    summary: str(raw.summary).trim(),
    sources: sources,
    tags: Array.isArray(raw.tags) ? raw.tags.map(str) : [],
    danger: raw.danger === "high" || raw.danger === "medium" ? raw.danger : null,
    examples: Array.isArray(raw.examples) ? raw.examples.filter(function(ex) {
      return ex && str(ex.cmd).trim()
    }).map(function(ex) {
      return { label: str(ex.label).trim() || "Example", cmd: str(ex.cmd).trim() }
    }) : [],
    flags: Array.isArray(raw.flags) ? raw.flags.filter(function(f) {
      return f && str(f.flag).trim()
    }).map(function(f) {
      return { flag: str(f.flag).trim(), meaning: str(f.meaning).trim() }
    }) : [],
    related: Array.isArray(raw.related) ? raw.related.map(str).filter(Boolean) : [],
    man: str(raw.man).trim() || null,
    starter: !!raw.starter
  }
}

function normalizeLibrary(rawList) {
  var out = []
  var seen = {}
  var list = rawList || []
  for (var i = 0; i < list.length; i++) {
    var entry = normalizeEntry(list[i])
    if (!entry || seen[entry.id]) continue
    seen[entry.id] = true
    out.push(entry)
  }
  return out
}

function findTopic(topicId) {
  var want = str(topicId)
  for (var i = 0; i < TOPICS.length; i++) {
    if (TOPICS[i].id === want) return TOPICS[i]
  }
  return null
}

function entryMatchesTopic(entry, topic) {
  if (!entry || !topic) return false
  var cmd = str(entry.command).toLowerCase()
  var commands = topic.commands || []
  for (var c = 0; c < commands.length; c++) {
    if (cmd === str(commands[c]).toLowerCase()) return true
  }
  var prefixes = topic.commandPrefixes || []
  for (var p = 0; p < prefixes.length; p++) {
    var prefix = str(prefixes[p]).toLowerCase()
    if (prefix && cmd.indexOf(prefix) === 0) return true
  }
  var want = {}
  var tags = topic.tags || []
  for (var t = 0; t < tags.length; t++) want[str(tags[t]).toLowerCase()] = true
  var entryTags = entry.tags || []
  for (var e = 0; e < entryTags.length; e++) {
    if (want[str(entryTags[e]).toLowerCase()]) return true
  }
  return false
}

function topicCount(library, sources, topic) {
  var n = 0
  var list = library || []
  for (var i = 0; i < list.length; i++) {
    if (!sourceAllowed(list[i], sources)) continue
    if (entryMatchesTopic(list[i], topic)) n++
  }
  return n
}

function topicBrowseResults(library, sources) {
  var out = []
  for (var i = 0; i < TOPICS.length; i++) {
    var topic = TOPICS[i]
    var count = topicCount(library, sources, topic)
    if (count <= 0) continue
    out.push({
      id: "topic:" + topic.id,
      command: topic.label,
      title: count + " command" + (count === 1 ? "" : "s"),
      summary: topic.summary,
      sources: [],
      danger: null,
      score: 1000 - i,
      used: false,
      kind: "topic",
      topicId: topic.id,
      topicCount: count
    })
  }
  return out
}

function resultRow(entry, score, used) {
  return {
    id: entry.id,
    command: entry.command,
    title: entry.title,
    summary: entry.summary,
    sources: entry.sources.slice(),
    danger: entry.danger,
    score: score,
    used: !!used,
    kind: "command"
  }
}

// Small Levenshtein for “did you mean”; capped length keeps it cheap.
function editDistance(a, b) {
  var s = str(a)
  var t = str(b)
  if (s === t) return 0
  if (!s.length) return t.length
  if (!t.length) return s.length
  if (Math.abs(s.length - t.length) > 6) return 99
  var prev = []
  var cur = []
  var i
  var j
  for (j = 0; j <= t.length; j++) prev[j] = j
  for (i = 1; i <= s.length; i++) {
    cur[0] = i
    for (j = 1; j <= t.length; j++) {
      var cost = s.charAt(i - 1) === t.charAt(j - 1) ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    for (j = 0; j <= t.length; j++) prev[j] = cur[j]
  }
  return prev[t.length]
}

function fuzzyScore(entry, query) {
  var q = str(query).trim().toLowerCase()
  if (!q || !entry) return 0
  var cmd = str(entry.command).toLowerCase()
  var title = str(entry.title).toLowerCase()
  var id = str(entry.id).toLowerCase()
  var score = 0

  if (cmd === q) score += 500
  else if (cmd.indexOf(q) === 0) score += 320
  else if (cmd.indexOf(q) >= 0) score += 200

  if (id.indexOf(q) >= 0) score += 80
  if (title.indexOf(q) >= 0) score += 60

  var cmdDist = editDistance(cmd, q)
  if (cmdDist <= 2) score += 180 - cmdDist * 40
  else if (cmdDist <= 4) score += 80 - cmdDist * 10

  var parts = cmd.split(/\s+/)
  var last = parts.length ? parts[parts.length - 1] : ""
  if (last) {
    var lastDist = editDistance(last, q)
    if (lastDist <= 2) score += 140 - lastDist * 30
  }

  // Compact form: "pacmans" vs "pacman -S" style tokens.
  var compact = cmd.replace(/[^a-z0-9]+/g, "")
  var qCompact = q.replace(/[^a-z0-9]+/g, "")
  if (qCompact.length >= 3) {
    if (compact.indexOf(qCompact) >= 0) score += 90
    var cDist = editDistance(compact, qCompact)
    if (cDist <= 2) score += 100 - cDist * 25
  }
  return score
}

function didYouMean(library, query, sources, limit) {
  var cap = limit > 0 ? limit : SUGGESTION_LIMIT
  var list = library || []
  var pool = []
  for (var i = 0; i < list.length; i++) {
    var entry = list[i]
    if (!sourceAllowed(entry, sources)) continue
    var score = fuzzyScore(entry, query)
    if (score < 80) continue
    pool.push({ entry: entry, score: score })
  }
  pool.sort(function(a, b) {
    if (b.score !== a.score) return b.score - a.score
    if (a.entry.command < b.entry.command) return -1
    if (a.entry.command > b.entry.command) return 1
    return 0
  })
  var results = []
  for (var r = 0; r < pool.length && r < cap; r++) {
    results.push(resultRow(pool[r].entry, pool[r].score, false))
  }
  return results
}

function search(library, query, sources, frecency, limit, topicId) {
  var cap = limit > 0 ? limit : MAX_RESULTS
  var terms = words(query)
  var pool = []
  var list = library || []
  var topic = findTopic(topicId)
  if (!anySourceOn(sources)) {
    return {
      results: [],
      meta: {
        total: 0, shown: 0, emptySources: true, idle: terms.length === 0,
        browsingTopics: false, topicId: "", didYouMean: false
      }
    }
  }

  // Empty query, no topic: browse topics instead of a flat starter dump.
  if (!terms.length && !topic) {
    var topics = topicBrowseResults(library, sources)
    return {
      results: topics,
      meta: {
        total: topics.length,
        shown: topics.length,
        truncated: false,
        emptySources: false,
        idle: true,
        browsingTopics: true,
        topicId: "",
        didYouMean: false
      }
    }
  }

  for (var i = 0; i < list.length; i++) {
    var entry = list[i]
    if (!sourceAllowed(entry, sources)) continue
    if (topic && !entryMatchesTopic(entry, topic)) continue
    if (!matchesAll(entry, terms)) continue
    var id = str(entry.id)
    var relevance = relevanceScore(entry, terms)
    var usedBoost = frecencyBoost(id, frecency)
    pool.push({
      entry: entry,
      relevance: relevance,
      usedBoost: usedBoost,
      // Most-used floats up among real matches; weak/example-only hits
      // cannot outrank a strong match just because they were copied a lot.
      score: relevance + Math.min(usedBoost, Math.max(relevance, 1))
    })
  }

  pool.sort(function(a, b) {
    if (b.score !== a.score) return b.score - a.score
    if (b.usedBoost !== a.usedBoost) return b.usedBoost - a.usedBoost
    if (a.entry.command < b.entry.command) return -1
    if (a.entry.command > b.entry.command) return 1
    return 0
  })

  // Topic idle view: prefer starters, then cap.
  if (!terms.length && topic) {
    pool.sort(function(a, b) {
      if (!!b.entry.starter !== !!a.entry.starter) return b.entry.starter ? 1 : -1
      if (b.usedBoost !== a.usedBoost) return b.usedBoost - a.usedBoost
      if (b.score !== a.score) return b.score - a.score
      if (a.entry.command < b.entry.command) return -1
      if (a.entry.command > b.entry.command) return 1
      return 0
    })
  }

  var results = []
  for (var r = 0; r < pool.length && r < cap; r++) {
    results.push(resultRow(pool[r].entry, pool[r].score, pool[r].usedBoost > 0))
  }

  var didMean = false
  if (!results.length && terms.length) {
    results = didYouMean(library, query, sources, SUGGESTION_LIMIT)
    didMean = results.length > 0
  }

  return {
    results: results,
    meta: {
      total: didMean ? results.length : pool.length,
      shown: results.length,
      truncated: !didMean && pool.length > results.length,
      emptySources: false,
      idle: terms.length === 0,
      browsingTopics: false,
      topicId: topic ? topic.id : "",
      topicLabel: topic ? topic.label : "",
      didYouMean: didMean
    }
  }
}

function findById(library, id) {
  var want = str(id)
  var list = library || []
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === want) return list[i]
  }
  return null
}

function primaryExample(entry) {
  if (!entry) return ""
  if (entry.examples && entry.examples.length) return entry.examples[0].cmd
  return entry.command
}

function copyTarget(entry, exampleIndex) {
  if (!entry) return ""
  var idx = exampleIndex >= 0 ? exampleIndex : 0
  if (entry.examples && entry.examples[idx]) return entry.examples[idx].cmd
  return primaryExample(entry)
}

function recordUse(frecency, id, now) {
  var next = {}
  var src = frecency || {}
  for (var key in src) {
    if (Object.prototype.hasOwnProperty.call(src, key)) next[key] = { n: src[key].n, t: src[key].t }
  }
  var cur = next[id] || { n: 0, t: 0 }
  next[id] = { n: (Number(cur.n) || 0) + 1, t: now || Date.now() }
  return next
}

function parseFrecency(raw) {
  var out = {}
  var text = str(raw).trim()
  if (!text) return out
  var data = null
  try { data = JSON.parse(text) } catch (e) { return out }
  var map = data && data.used ? data.used : data
  if (!map || typeof map !== "object") return out
  for (var id in map) {
    if (!Object.prototype.hasOwnProperty.call(map, id)) continue
    var rec = map[id]
    if (!rec || typeof rec !== "object") continue
    out[id] = { n: Number(rec.n) || 0, t: Number(rec.t) || 0 }
  }
  return out
}

function serializeFrecency(frecency) {
  return JSON.stringify({ used: frecency || {} }) + "\n"
}

function parseSavedSources(raw) {
  var text = str(raw).trim()
  if (!text) return defaultSources()
  try {
    var data = JSON.parse(text)
    return normalizeSources(data && data.sources ? data.sources : data)
  } catch (e) {
    return defaultSources()
  }
}

function serializeSources(sources) {
  return JSON.stringify({ sources: normalizeSources(sources) }) + "\n"
}

function sourceBadges(entry) {
  var list = entry && entry.sources ? entry.sources : []
  var out = []
  for (var i = 0; i < list.length; i++) out.push(sourceLabel(list[i]))
  return out
}

function sourceKeys(entry) {
  return entry && entry.sources ? entry.sources.slice() : []
}

function dangerLabel(danger) {
  if (danger === "high") return "Dangerous"
  if (danger === "medium") return "Careful"
  return ""
}

function footerHints(hasSelection, meta) {
  var hints = []
  var m = meta || {}
  if (m.browsingTopics) {
    hints.push("⏎ open topic")
    hints.push("type to search")
    hints.push("esc close")
    return hints
  }
  if (m.didYouMean) {
    hints.push("⏎ copy example")
    hints.push("type to refine")
    hints.push("esc clear")
    return hints
  }
  if (hasSelection) {
    hints.push("⏎ copy example")
    hints.push("[ ] cycle")
    hints.push("⇧⏎ man")
  }
  if (m.topicId) hints.push("esc topics")
  else hints.push("esc close")
  return hints
}

function indexOfId(results, id) {
  var want = str(id)
  var list = results || []
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === want) return i
  }
  return -1
}

function markUsed(results, id) {
  var want = str(id)
  var out = []
  var list = results || []
  for (var i = 0; i < list.length; i++) {
    var row = list[i]
    if (row.id === want) {
      out.push({
        id: row.id,
        command: row.command,
        title: row.title,
        summary: row.summary,
        sources: row.sources,
        danger: row.danger,
        score: row.score,
        used: true,
        kind: row.kind || "command",
        topicId: row.topicId,
        topicCount: row.topicCount
      })
    } else {
      out.push(row)
    }
  }
  return out
}

function relatedEntries(library, entry, sources, limit) {
  if (!entry) return []
  var names = entry.related || []
  var out = []
  var cap = limit > 0 ? limit : 6
  // Related spans source pills on purpose — the chain is how you discover
  // the Arch/Omarchy cousin of a Linux command.
  for (var i = 0; i < names.length && out.length < cap; i++) {
    var name = str(names[i]).toLowerCase()
    var list = library || []
    for (var j = 0; j < list.length; j++) {
      var other = list[j]
      if (other.id === entry.id) continue
      if (other.id === name || other.command.toLowerCase() === name) {
        out.push(other)
        break
      }
    }
  }
  return out
}

// Turn on every source the entry belongs to, so a related jump is never empty.
function openSourcesFor(entry, sources) {
  var next = normalizeSources(sources)
  var list = entry && entry.sources ? entry.sources : []
  for (var i = 0; i < list.length; i++) {
    if (SOURCES.indexOf(list[i]) >= 0) next[list[i]] = true
  }
  return next
}

// --- Live Omarchy catalog (`omarchy commands --json`) -------------------------

function uniqueStrings(list) {
  var out = []
  var seen = {}
  var src = list || []
  for (var i = 0; i < src.length; i++) {
    var v = str(src[i]).trim()
    if (!v) continue
    var key = v.toLowerCase()
    if (seen[key]) continue
    seen[key] = true
    out.push(v)
  }
  return out
}

function omarchyIdFromRoute(route) {
  var r = str(route).trim().toLowerCase()
  if (!r) return ""
  if (r.indexOf("omarchy ") === 0) r = r.slice(8)
  else if (r === "omarchy") return "omarchy"
  r = r.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return r ? "omarchy-" + r : ""
}

function titleFromOmarchySummary(summary, route) {
  var s = str(summary).trim()
  if (s) {
    if (s.charAt(s.length - 1) === ".") s = s.slice(0, -1)
    return s
  }
  var r = str(route).trim()
  if (r.indexOf("omarchy ") === 0) r = r.slice(8)
  return r || "Omarchy command"
}

// Group-level intent words for natural-language Omarchy search.
var OMARCHY_GROUP_INTENTS = {
  audio: ["sound", "volume", "speaker", "speakers", "headphones", "microphone", "mic", "mute", "unmute"],
  brightness: ["backlight", "dim", "bright", "screen brightness", "keyboard light", "led"],
  capture: ["screenshot", "screengrab", "record", "recording", "ocr", "qr", "webcam", "camera", "photo"],
  theme: ["appearance", "colors", "look", "dark", "light", "wallpaper", "background", "style"],
  pkg: ["package", "packages", "install", "uninstall", "software", "app", "apps"],
  plugin: ["plugins", "extension", "extensions", "overlay", "shell plugin"],
  font: ["fonts", "typeface", "typography"],
  system: ["power", "session", "lock", "logout", "reboot", "shutdown", "sleep", "wake"],
  network: ["wifi", "wireless", "ethernet", "internet", "dns", "vpn"],
  bluetooth: ["bt", "wireless", "headphones", "earbuds"],
  battery: ["power", "charge", "charging", "laptop"],
  update: ["upgrade", "patch", "system update"],
  install: ["setup", "add"],
  remove: ["uninstall", "delete", "drop"],
  refresh: ["reload", "restart ui"],
  restart: ["reload", "reboot service"],
  toggle: ["show", "hide", "enable", "disable"],
  default: ["defaults", "preferred", "browser", "editor", "terminal"],
  agent: ["ai", "coding agent", "assistant", "claude", "codex"],
  reminder: ["remind", "timer", "notify", "notification", "alarm"],
  share: ["send", "transfer", "airdrop"],
  snapshot: ["backup", "btrfs", "restore"],
  hyprland: ["hypr", "window manager", "wm", "compositor"],
  launch: ["open", "start", "run app"],
  menu: ["walker", "launcher"],
  bar: ["status bar", "waybar", "panel"],
  notification: ["notify", "toast", "alert"],
  powerprofiles: ["power profile", "performance", "balanced", "saver"],
  screensaver: ["idle", "lock screen art"],
  shell: ["omarchy-shell", "quickshell"],
  dns: ["resolver", "nameserver"],
  channel: ["stable", "edge", "rc", "release channel"]
}

// Route-specific phrases (kept as tags so “mute mic” ranks the right row).
var OMARCHY_ROUTE_INTENTS = {
  "audio input mute": ["mute mic", "mute microphone", "mic mute", "microphone mute", "unmute mic", "mic"],
  "audio output volume": ["volume", "louder", "quieter", "sound level"],
  "audio output switch": ["switch speaker", "change output", "headphones"],
  "audio source switch": ["switch mic", "change input", "microphone"],
  "capture screenshot": ["take screenshot", "screen shot", "grab screen"],
  "capture screenrecording": ["record screen", "screen record", "video capture"],
  "capture text": ["ocr", "copy text from screen", "screen text"],
  "capture qr": ["scan qr", "qr code"],
  "theme set": ["change theme", "set theme", "apply theme", "switch theme"],
  "theme bg next": ["next wallpaper", "change background", "next background"],
  "pkg add": ["install package", "add package", "install app"],
  "pkg aur add": ["install aur", "aur package"],
  "pkg drop": ["remove package", "uninstall package"],
  "plugin add": ["install plugin", "add plugin"],
  "system lock": ["lock screen", "lock session"],
  "system logout": ["log out", "sign out"],
  "system reboot": ["restart computer", "reboot machine"],
  "update": ["system update", "update omarchy", "upgrade system"],
  "reminder": ["set reminder", "remind me", "timer"],
  "font set": ["change font", "set font"],
  "default browser": ["set browser", "change browser"],
  "default editor": ["set editor", "change editor"],
  "default terminal": ["set terminal", "change terminal"],
  "toggle bar": ["hide bar", "show bar"],
  "toggle idle": ["caffeine", "keep awake", "prevent sleep"]
}

function omarchyGroup(command) {
  var r = str(command).trim().toLowerCase()
  if (r.indexOf("omarchy ") !== 0) return ""
  var rest = r.slice(8).split(/\s+/)
  return rest[0] || ""
}

function omarchyRouteKey(command) {
  var r = str(command).trim().toLowerCase()
  if (r.indexOf("omarchy ") === 0) return r.slice(8)
  return r
}

function humanizeFlag(flag) {
  var body = str(flag).replace(/^--/, "").replace(/=.*$/, "").replace(/-/g, " ").trim()
  if (!body) return "Option"
  return body.charAt(0).toUpperCase() + body.slice(1)
}

function flagsFromOmarchyArgs(args) {
  var text = str(args).trim()
  if (!text) return []
  var out = []
  var seen = {}
  var flagRe = /--[a-z0-9]+(?:-[a-z0-9]+)*(?:=<[^>\]]+>)?/gi
  var match
  while ((match = flagRe.exec(text)) !== null) {
    var token = match[0]
    var name = token.replace(/=<[^>\]]+>$/, "")
    if (seen[name]) continue
    seen[name] = true
    var value = token.indexOf("=<") >= 0 ? token.replace(/^.*?=/ , "") : ""
    out.push({
      flag: name,
      meaning: value ? humanizeFlag(name) + " (" + value + ")" : humanizeFlag(name)
    })
  }
  var posRe = /<([a-z0-9_|.-]+)>/gi
  while ((match = posRe.exec(text)) !== null) {
    var full = match[0]
    if (seen[full]) continue
    // Skip values that belong to --flag=<...> (already handled).
    var at = match.index
    if (at >= 2 && text.slice(at - 2, at) === "=<") continue
    seen[full] = true
    out.push({ flag: full, meaning: "Argument: " + match[1].replace(/\|/g, " | ") })
  }
  return out
}

function flagsFromUsageExamples(entry) {
  var examples = entry && entry.examples ? entry.examples : []
  for (var i = 0; i < examples.length; i++) {
    if (str(examples[i].label) !== "Usage shape") continue
    var cmd = str(examples[i].cmd)
    var route = str(entry.command)
    var args = cmd.indexOf(route) === 0 ? cmd.slice(route.length).trim() : cmd
    return flagsFromOmarchyArgs(args)
  }
  return []
}

function intentTagsForOmarchy(command, group, summary) {
  var tags = []
  var g = str(group).trim().toLowerCase() || omarchyGroup(command)
  var groupIntents = OMARCHY_GROUP_INTENTS[g] || []
  for (var i = 0; i < groupIntents.length; i++) tags.push(groupIntents[i])

  var routeKey = omarchyRouteKey(command)
  var routeIntents = OMARCHY_ROUTE_INTENTS[routeKey] || []
  for (var r = 0; r < routeIntents.length; r++) tags.push(routeIntents[r])

  // Also attach intents for shorter route prefixes (theme set ← theme).
  var parts = routeKey.split(/\s+/).filter(Boolean)
  for (var len = parts.length - 1; len >= 1; len--) {
    var prefix = parts.slice(0, len).join(" ")
    var nested = OMARCHY_ROUTE_INTENTS[prefix]
    if (!nested) continue
    for (var n = 0; n < nested.length; n++) tags.push(nested[n])
  }

  var blob = (str(summary) + " " + routeKey).toLowerCase()
  if (blob.indexOf("microphone") >= 0 || /\bmic\b/.test(blob)) {
    tags.push("mic", "microphone")
  }
  if (blob.indexOf("mute") >= 0) tags.push("mute", "unmute")
  if (blob.indexOf("screenshot") >= 0) tags.push("screenshot", "screengrab")
  if (blob.indexOf("wallpaper") >= 0 || blob.indexOf("background") >= 0) {
    tags.push("wallpaper", "background")
  }
  return uniqueStrings(tags)
}

function tagsFromOmarchy(raw, route) {
  var tags = []
  var group = str(raw && raw.group).trim().toLowerCase()
  if (group) tags.push(group)
  var name = str(raw && raw.name).trim().toLowerCase()
  if (name) {
    var parts = name.split(/\s+/)
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].length > 1) tags.push(parts[i])
    }
  }
  var aliases = raw && raw.aliases ? raw.aliases : []
  for (var a = 0; a < aliases.length; a++) {
    var alias = str(aliases[a]).trim().toLowerCase()
    if (!alias) continue
    tags.push(alias)
    if (alias.indexOf("omarchy ") === 0) tags.push(alias.slice(8))
  }
  var r = str(route).trim().toLowerCase()
  if (r.indexOf("omarchy ") === 0) {
    var words = r.slice(8).split(/\s+/)
    for (var w = 0; w < words.length; w++) {
      if (words[w].length > 1) tags.push(words[w])
    }
  }
  var intents = intentTagsForOmarchy(route, group, raw && raw.summary)
  for (var t = 0; t < intents.length; t++) tags.push(intents[t])
  return uniqueStrings(tags)
}

function examplesFromOmarchy(raw, route) {
  var out = []
  var seen = {}
  function add(label, cmd) {
    var c = str(cmd).trim()
    if (!c || seen[c]) return
    seen[c] = true
    out.push({ label: str(label).trim() || "Example", cmd: c })
  }

  var list = raw && raw.examples ? raw.examples : []
  for (var i = 0; i < list.length; i++) {
    var cmd = str(list[i]).trim()
    if (!cmd) continue
    var label = "Example"
    if (cmd === route) label = "Run"
    else if (cmd.indexOf(route + " ") === 0) label = "With options"
    else if (cmd.indexOf("omarchy ") === 0) label = "Alias / variant"
    add(label, cmd)
  }

  var aliases = raw && raw.aliases ? raw.aliases : []
  for (var a = 0; a < aliases.length; a++) add("Alias", aliases[a])

  if (!out.length) add("Run", route)
  return out
}

// One row from `omarchy commands --json`.
function fromOmarchyCommand(raw) {
  if (!raw || typeof raw !== "object") return null
  if (raw.hidden) return null
  var route = str(raw.route || raw.filename_route).trim()
  if (!route) return null
  var id = str(raw.binary).trim() || omarchyIdFromRoute(route)
  if (!id) return null
  var summary = str(raw.summary).trim()
  var title = titleFromOmarchySummary(summary, route)
  return normalizeEntry({
    id: id,
    command: route,
    title: title,
    summary: summary || (title + "."),
    sources: ["omarchy"],
    tags: tagsFromOmarchy(raw, route),
    danger: raw.requires_sudo ? "medium" : null,
    examples: examplesFromOmarchy(raw, route),
    flags: flagsFromOmarchyArgs(raw.args),
    related: [],
    man: null,
    starter: false
  })
}

// Accepts the CLI payload `{ ok, commands }` or a bare array.
function fromOmarchyCommandsJson(raw) {
  var text = str(raw).trim()
  if (!text) return []
  var data = null
  try { data = JSON.parse(text) } catch (e) { return [] }
  var list = []
  if (Array.isArray(data)) list = data
  else if (data && Array.isArray(data.commands)) list = data.commands
  else return []

  var out = []
  for (var i = 0; i < list.length; i++) {
    var entry = fromOmarchyCommand(list[i])
    if (entry) out.push(entry)
  }
  return normalizeLibrary(out)
}

function mergeOmarchyEntry(base, live) {
  if (!base) return live
  if (!live) return base
  return normalizeEntry({
    id: base.id,
    command: base.command || live.command,
    title: base.title || live.title,
    summary: base.summary || live.summary,
    sources: uniqueStrings((base.sources || []).concat(live.sources || [])),
    tags: uniqueStrings((base.tags || []).concat(live.tags || [])),
    danger: base.danger || live.danger,
    examples: (base.examples && base.examples.length) ? base.examples : live.examples,
    flags: (base.flags && base.flags.length) ? base.flags : live.flags,
    related: (base.related && base.related.length) ? base.related : live.related,
    man: base.man || live.man,
    starter: !!(base.starter || live.starter)
  })
}

// Curated library wins on overlap (matched by command). Live Omarchy rows fill gaps.
function mergeLibraries(baseList, liveList) {
  var base = normalizeLibrary(baseList)
  var live = normalizeLibrary(liveList)
  var out = []
  var byCommand = {}

  for (var i = 0; i < base.length; i++) {
    var entry = base[i]
    byCommand[str(entry.command).toLowerCase()] = out.length
    out.push(entry)
  }

  for (var j = 0; j < live.length; j++) {
    var row = live[j]
    var key = str(row.command).toLowerCase()
    var at = byCommand[key]
    if (at === undefined) {
      byCommand[key] = out.length
      out.push(row)
    } else {
      out[at] = mergeOmarchyEntry(out[at], row)
    }
  }
  return out
}

// Hand-maintained flags for common Linux/Arch rows that shipped without them.
var COMMON_FLAGS = {
  "pwd": [{ flag: "-P", meaning: "Physical path (resolve symlinks)" }],
  "cd": [
    { flag: "-", meaning: "Go to the previous directory" },
    { flag: "~", meaning: "Go to your home directory" }
  ],
  "touch": [{ flag: "-a", meaning: "Change access time only" }, { flag: "-m", meaning: "Change modify time only" }],
  "rmdir": [{ flag: "-p", meaning: "Remove parent directories too if empty" }],
  "cat": [{ flag: "-n", meaning: "Number all lines" }, { flag: "-A", meaning: "Show non-printing characters" }],
  "less": [
    { flag: "-N", meaning: "Show line numbers" },
    { flag: "-S", meaning: "Chop long lines instead of wrapping" },
    { flag: "-i", meaning: "Ignore case when searching" }
  ],
  "echo": [{ flag: "-n", meaning: "No trailing newline" }, { flag: "-e", meaning: "Enable backslash escapes" }],
  "chmod": [
    { flag: "-R", meaning: "Apply recursively" },
    { flag: "-v", meaning: "Verbose output" },
    { flag: "u+x", meaning: "Add execute for the owner" }
  ],
  "ps": [
    { flag: "aux", meaning: "All processes, with user and CPU/mem" },
    { flag: "-ef", meaning: "Full format listing" },
    { flag: "-u", meaning: "Filter by user" }
  ],
  "pgrep": [
    { flag: "-a", meaning: "Show the full command line" },
    { flag: "-f", meaning: "Match against the full command line" },
    { flag: "-u", meaning: "Only this user's processes" }
  ],
  "pkill": [
    { flag: "-f", meaning: "Match against the full command line" },
    { flag: "-u", meaning: "Only this user's processes" },
    { flag: "-9", meaning: "Force kill (SIGKILL)" }
  ],
  "killall": [
    { flag: "-9", meaning: "Force kill (SIGKILL)" },
    { flag: "-i", meaning: "Ask before killing" },
    { flag: "-u", meaning: "Only this user's processes" }
  ],
  "top": [{ flag: "-u", meaning: "Only this user" }, { flag: "-p", meaning: "Only these PIDs" }],
  "htop": [{ flag: "-u", meaning: "Only this user" }, { flag: "-t", meaning: "Tree view" }],
  "nice": [{ flag: "-n", meaning: "Niceness value (-20..19)" }],
  "sleep": [{ flag: "number", meaning: "Seconds to pause (or 5m / 1h with GNU sleep)" }],
  "hostnamectl": [
    { flag: "status", meaning: "Show current hostname and OS info" },
    { flag: "set-hostname", meaning: "Change the hostname" }
  ],
  "uptime": [{ flag: "-p", meaning: "Pretty format" }, { flag: "-s", meaning: "Time the system came up" }],
  "date": [
    { flag: "+FORMAT", meaning: "Custom format, e.g. +%Y-%m-%d" },
    { flag: "-u", meaning: "UTC / GMT" }
  ],
  "timedatectl": [
    { flag: "status", meaning: "Show clock and timezone" },
    { flag: "set-timezone", meaning: "Change timezone" },
    { flag: "set-ntp", meaning: "Turn network time on/off" }
  ],
  "env": [{ flag: "-i", meaning: "Empty environment" }, { flag: "-u", meaning: "Unset a variable" }],
  "printenv": [{ flag: "NAME", meaning: "Print one variable" }],
  "which": [{ flag: "-a", meaning: "Show all matches on PATH" }],
  "type": [{ flag: "-a", meaning: "Show all locations / definitions" }],
  "history": [{ flag: "-c", meaning: "Clear history" }, { flag: "-d", meaning: "Delete one entry" }],
  "man": [
    { flag: "-k", meaning: "Search descriptions (apropos)" },
    { flag: "-f", meaning: "Short description (whatis)" },
    { flag: "2", meaning: "Section 2 (system calls), etc." }
  ],
  "tldr": [{ flag: "-p", meaning: "Platform (linux, osx, …)" }, { flag: "--list", meaning: "List all pages" }],
  "ip addr": [{ flag: "show", meaning: "Show addresses" }, { flag: "add", meaning: "Add an address" }],
  "ip route": [{ flag: "show", meaning: "Show routes" }, { flag: "get", meaning: "How a destination is reached" }],
  "ip link": [{ flag: "show", meaning: "Show interfaces" }, { flag: "set", meaning: "Change interface state" }],
  "nmcli": [
    { flag: "device wifi list", meaning: "Scan Wi-Fi networks" },
    { flag: "connection show", meaning: "List saved connections" },
    { flag: "--ask", meaning: "Prompt for secrets" }
  ],
  "ssh-keygen": [
    { flag: "-t", meaning: "Key type (ed25519, rsa, …)" },
    { flag: "-C", meaning: "Comment" },
    { flag: "-f", meaning: "Output file path" }
  ],
  "unzip": [{ flag: "-l", meaning: "List archive contents" }, { flag: "-d", meaning: "Extract into a directory" }],
  "zstd": [
    { flag: "-d", meaning: "Decompress" },
    { flag: "-#", meaning: "Compression level 1–19" },
    { flag: "-t", meaning: "Test integrity" }
  ],
  "systemctl status": [
    { flag: "--no-pager", meaning: "Do not open a pager" },
    { flag: "-l", meaning: "Full output (no ellipsis)" }
  ],
  "systemctl start": [{ flag: "--now", meaning: "Often paired with enable" }],
  "systemctl stop": [{ flag: "--now", meaning: "Often paired with disable" }],
  "systemctl restart": [{ flag: "--now", meaning: "Start if inactive, else restart" }],
  "systemctl list-units": [
    { flag: "--type=service", meaning: "Only services" },
    { flag: "--state=failed", meaning: "Only failed units" },
    { flag: "--all", meaning: "Include inactive" }
  ],
  "loginctl": [
    { flag: "list-sessions", meaning: "Show login sessions" },
    { flag: "lock-session", meaning: "Lock a session" }
  ],
  "nano": [
    { flag: "-v", meaning: "View only (read-only)" },
    { flag: "+LINE", meaning: "Start at a line number" }
  ],
  "nvim": [
    { flag: "+LINE", meaning: "Start at a line number" },
    { flag: "-O", meaning: "Vertical splits" },
    { flag: "-p", meaning: "Open files in tabs" }
  ],
  "vim": [
    { flag: "+LINE", meaning: "Start at a line number" },
    { flag: "-O", meaning: "Vertical splits" },
    { flag: "-R", meaning: "Read-only" }
  ],
  "xargs": [
    { flag: "-n", meaning: "Max arguments per command" },
    { flag: "-P", meaning: "Run up to N processes in parallel" },
    { flag: "-I{}", meaning: "Replace {} in the command" }
  ],
  "awk": [
    { flag: "-F", meaning: "Field separator" },
    { flag: "-f", meaning: "Read program from a file" }
  ],
  "git status": [
    { flag: "-sb", meaning: "Short branch summary" },
    { flag: "-u", meaning: "Show untracked files" }
  ],
  "git clone": [
    { flag: "--depth 1", meaning: "Shallow clone" },
    { flag: "-b", meaning: "Checkout this branch" }
  ],
  "git pull": [
    { flag: "--rebase", meaning: "Rebase instead of merge" },
    { flag: "--ff-only", meaning: "Fail unless fast-forward" }
  ],
  "git add": [
    { flag: "-p", meaning: "Patch mode (stage hunks)" },
    { flag: "-A", meaning: "Stage all changes" },
    { flag: "-u", meaning: "Stage tracked files only" }
  ],
  "git push": [
    { flag: "-u", meaning: "Set upstream tracking" },
    { flag: "--force-with-lease", meaning: "Safer force push" }
  ],
  "git diff": [
    { flag: "--stat", meaning: "Summary of changes" },
    { flag: "--staged", meaning: "Compare staged changes" }
  ],
  "git log": [
    { flag: "--oneline", meaning: "One line per commit" },
    { flag: "-p", meaning: "Show patches" },
    { flag: "--graph", meaning: "ASCII commit graph" }
  ],
  "git branch": [
    { flag: "-a", meaning: "List local and remote" },
    { flag: "-d", meaning: "Delete a branch" },
    { flag: "-m", meaning: "Rename current branch" }
  ],
  "git switch": [
    { flag: "-c", meaning: "Create and switch" },
    { flag: "-", meaning: "Switch to previous branch" }
  ],
  "hyprctl": [
    { flag: "clients", meaning: "List windows" },
    { flag: "monitors", meaning: "List monitors" },
    { flag: "reload", meaning: "Reload config" }
  ],
  "grim": [
    { flag: "-g", meaning: "Capture a region (often from slurp)" },
    { flag: "-o", meaning: "Capture one output" }
  ],
  "slurp": [
    { flag: "-b", meaning: "Background color" },
    { flag: "-d", meaning: "Dimension display" }
  ],
  "notify-send": [
    { flag: "-u", meaning: "Urgency (low, normal, critical)" },
    { flag: "-t", meaning: "Expire time in ms" },
    { flag: "-i", meaning: "Icon name or path" }
  ],
  "xdg-open": [{ flag: "FILE|URL", meaning: "Open with the default app" }],
  "trash-put": [{ flag: "-v", meaning: "Verbose" }, { flag: "--", meaning: "End of options" }],
  "mount": [
    { flag: "-a", meaning: "Mount all from fstab" },
    { flag: "-t", meaning: "Filesystem type" },
    { flag: "-o", meaning: "Options (ro, noatime, …)" }
  ],
  "umount": [{ flag: "-l", meaning: "Lazy unmount" }, { flag: "-f", meaning: "Force unmount" }],
  "lsblk": [
    { flag: "-f", meaning: "Show filesystems" },
    { flag: "-o", meaning: "Custom columns" },
    { flag: "-J", meaning: "JSON output" }
  ],
  "stat": [
    { flag: "-c", meaning: "Custom format" },
    { flag: "-f", meaning: "Filesystem status instead of file" }
  ],
  "file": [{ flag: "-b", meaning: "Brief (no filename prefix)" }, { flag: "-i", meaning: "MIME type" }],
  "realpath": [{ flag: "-s", meaning: "Do not resolve symlinks" }, { flag: "-m", meaning: "Allow missing path parts" }],
  "basename": [{ flag: "-s", meaning: "Strip this suffix" }],
  "dirname": [{ flag: "PATH", meaning: "Parent directory of PATH" }],
  "locate": [{ flag: "-i", meaning: "Case-insensitive" }, { flag: "-n", meaning: "Limit results" }],
  "updatedb": [{ flag: "-U", meaning: "Root directory to scan" }],
  "dust": [{ flag: "-d", meaning: "Depth limit" }, { flag: "-r", meaning: "Reverse sort" }],
  "nmap": [
    { flag: "-sn", meaning: "Ping scan only" },
    { flag: "-sV", meaning: "Service/version detection" },
    { flag: "-p", meaning: "Ports to scan" }
  ],
  "dig": [
    { flag: "+short", meaning: "Brief answer only" },
    { flag: "A", meaning: "IPv4 address query" },
    { flag: "@server", meaning: "Ask this DNS server" }
  ],
  "host": [{ flag: "-a", meaning: "All records" }, { flag: "-t", meaning: "Query type" }],
  "traceroute": [{ flag: "-n", meaning: "No DNS lookups" }, { flag: "-I", meaning: "Use ICMP" }],
  "coredumpctl": [
    { flag: "list", meaning: "List coredumps" },
    { flag: "info", meaning: "Details for one dump" },
    { flag: "gdb", meaning: "Open in gdb" }
  ],
  "pacman -Syu": [
    { flag: "--noconfirm", meaning: "Do not ask for confirmation" },
    { flag: "--needed", meaning: "Skip up-to-date packages" }
  ],
  "pacman -S": [
    { flag: "--needed", meaning: "Skip up-to-date packages" },
    { flag: "--asdeps", meaning: "Install as a dependency" },
    { flag: "--noconfirm", meaning: "Do not ask for confirmation" }
  ],
  "pacman -Ss": [{ flag: "regex", meaning: "Search package names and descriptions" }],
  "paru": [
    { flag: "-Syu", meaning: "Upgrade repo + AUR" },
    { flag: "-S", meaning: "Install (AUR-aware)" },
    { flag: "-Ss", meaning: "Search" }
  ]
}

var COMMON_RELATED = {
  "pwd": ["cd", "ls", "realpath"],
  "cd": ["pwd", "ls", "pushd"],
  "touch": ["mkdir", "chmod", "stat"],
  "rmdir": ["rm", "mkdir", "ls"],
  "cat": ["less", "bat", "head", "tail"],
  "less": ["cat", "bat", "head"],
  "echo": ["printf", "printenv"],
  "printf": ["echo", "printenv"],
  "chmod": ["chown", "ls", "stat"],
  "ps": ["pgrep", "top", "htop", "btop", "kill"],
  "pgrep": ["ps", "pkill", "kill"],
  "pkill": ["pgrep", "kill", "killall"],
  "killall": ["pkill", "kill", "pgrep"],
  "top": ["htop", "btop", "ps"],
  "htop": ["btop", "top", "ps"],
  "btop": ["htop", "top", "ps"],
  "ip addr": ["ip route", "ip link", "nmcli", "curl ifconfig.me"],
  "ip route": ["ip addr", "ip link", "ping"],
  "ip link": ["ip addr", "nmcli"],
  "nmcli": ["nmtui", "ip addr", "ping"],
  "nmtui": ["nmcli", "ip addr"],
  "systemctl status": ["systemctl start", "systemctl stop", "journalctl"],
  "systemctl start": ["systemctl status", "systemctl enable", "systemctl stop"],
  "systemctl stop": ["systemctl status", "systemctl disable", "systemctl start"],
  "systemctl restart": ["systemctl status", "systemctl stop", "systemctl start"],
  "systemctl disable": ["systemctl stop", "systemctl enable", "systemctl status"],
  "systemctl list-units": ["systemctl status", "journalctl"],
  "git status": ["git diff", "git add", "git log"],
  "git clone": ["git pull", "git status"],
  "git pull": ["git push", "git fetch", "git status"],
  "git add": ["git commit", "git status", "git diff"],
  "git push": ["git pull", "git status", "git log"],
  "git diff": ["git status", "git add", "git log"],
  "git log": ["git diff", "git show", "git status"],
  "git branch": ["git switch", "git checkout", "git log"],
  "git switch": ["git branch", "git checkout", "git status"],
  "man": ["tldr", "help", "which"],
  "tldr": ["man", "help"],
  "nano": ["nvim", "vim", "bat"],
  "nvim": ["vim", "nano", "bat"],
  "vim": ["nvim", "nano"],
  "pacman -Syu": ["pacman -S", "paru", "paccache"],
  "pacman -S": ["pacman -Ss", "pacman -R", "paru"],
  "pacman -Ss": ["pacman -S", "pacman -Qi", "paru"],
  "paru": ["pacman -S", "pacman -Syu", "yay"],
  "grim": ["slurp", "wl-copy", "omarchy capture screenshot"],
  "slurp": ["grim", "omarchy capture screenshot"],
  "wl-copy": ["wl-paste", "grim"],
  "wl-paste": ["wl-copy"],
  "xdg-open": ["file", "mimeo"],
  "trash-put": ["rm", "rmdir"],
  "mount": ["umount", "lsblk", "df"],
  "umount": ["mount", "lsblk"],
  "lsblk": ["df", "mount", "fdisk"],
  "hyprctl": ["omarchy refresh shell", "journalctl"],
  "notify-send": ["omarchy reminder"],
  "curl ifconfig.me": ["ip addr", "dig"],
  "ssh-keygen": ["ssh", "ssh-copy-id"],
  "ssh-copy-id": ["ssh", "ssh-keygen"],
  "unzip": ["tar", "zip", "zstd"],
  "zstd": ["tar", "gzip", "unzip"],
  "awk": ["sed", "cut", "rg"],
  "xargs": ["find", "fd", "rg"],
  "env": ["printenv", "export"],
  "printenv": ["env", "echo"],
  "which": ["type", "command", "whereis"],
  "type": ["which", "command"],
  "hostnamectl": ["hostname", "timedatectl"],
  "hostname": ["hostnamectl", "uname"],
  "date": ["timedatectl", "cal"],
  "timedatectl": ["date", "hostnamectl"],
  "coredumpctl": ["journalctl", "dmesg"],
  "dmesg": ["journalctl", "coredumpctl"],
  "stat": ["ls", "file", "realpath"],
  "file": ["stat", "ls"],
  "realpath": ["readlink", "pwd", "basename"],
  "basename": ["dirname", "realpath"],
  "dirname": ["basename", "realpath"],
  "locate": ["updatedb", "fd", "find"],
  "updatedb": ["locate"],
  "dust": ["du", "df", "ncdu"],
  "nmap": ["ping", "ss", "traceroute"],
  "dig": ["host", "nslookup", "ping"],
  "host": ["dig", "ping"],
  "traceroute": ["ping", "mtr", "ip route"],
  "loginctl": ["systemctl", "who"],
  "groups": ["id", "usermod"],
  "passwd": ["sudo", "usermod"],
  "su": ["sudo", "login"],
  "whoami": ["id", "groups"],
  "id": ["whoami", "groups"],
  "jobs": ["fg", "bg", "ps"],
  "fg": ["bg", "jobs"],
  "bg": ["fg", "jobs"],
  "nohup": ["disown", "systemd-run"],
  "nice": ["renice", "ps"],
  "time": ["times", "hyperfine"],
  "sleep": ["timeout", "watch"],
  "cal": ["date", "timedatectl"],
  "history": ["alias", "which"],
  "clear": ["reset"],
  "help": ["man", "tldr"],
  "alias": ["type", "which"],
  "export": ["env", "printenv"],
  "source": ["export", "."],
  "fdisk": ["lsblk", "parted", "mkfs.ext4"],
  "mkfs.ext4": ["fdisk", "mount", "lsblk"],
  "fastfetch": ["uname", "hostnamectl"],
  "lscpu": ["lsusb", "lspci", "fastfetch"],
  "lsusb": ["lspci", "lscpu"],
  "lspci": ["lsusb", "lscpu"]
}

function libraryIndex(library) {
  var byCommand = {}
  var byId = {}
  var list = library || []
  for (var i = 0; i < list.length; i++) {
    byCommand[str(list[i].command).toLowerCase()] = list[i]
    byId[str(list[i].id)] = list[i]
  }
  return { byCommand: byCommand, byId: byId, list: list }
}

function suggestOmarchyRelated(entry, index) {
  var cmd = str(entry && entry.command)
  if (!cmd) return []
  var out = []
  var seen = {}
  function add(name) {
    var key = str(name).toLowerCase()
    if (!key || key === cmd.toLowerCase() || seen[key]) return
    if (!index.byCommand[key] && !index.byId[key]) return
    seen[key] = true
    out.push(index.byCommand[key] ? index.byCommand[key].command : name)
  }

  var parts = cmd.split(/\s+/)
  for (var drop = 1; drop < parts.length - 1 && out.length < 2; drop++) {
    add(parts.slice(0, parts.length - drop).join(" "))
  }

  var group = omarchyGroup(cmd)
  var prefix = parts.length >= 2 ? parts.slice(0, 2).join(" ") : cmd
  var list = index.list || []
  var scored = []
  for (var i = 0; i < list.length; i++) {
    var other = list[i]
    if (!other.sources || other.sources.indexOf("omarchy") < 0) continue
    if (other.command === cmd) continue
    var otherGroup = omarchyGroup(other.command)
    if (group && otherGroup !== group) continue
    var shared = 0
    var a = cmd.split(/\s+/)
    var b = other.command.split(/\s+/)
    while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared++
    if (shared < 2) continue
    scored.push({ command: other.command, shared: shared, len: other.command.length })
  }
  scored.sort(function(x, y) {
    if (y.shared !== x.shared) return y.shared - x.shared
    return x.len - y.len
  })
  for (var s = 0; s < scored.length && out.length < 5; s++) add(scored[s].command)

  if (prefix !== cmd) add(prefix)
  return out.slice(0, 5)
}

function withoutUsageShapeExamples(examples) {
  var out = []
  var list = examples || []
  for (var i = 0; i < list.length; i++) {
    if (str(list[i].label) === "Usage shape") continue
    out.push(list[i])
  }
  return out.length ? out : list
}

// Fill empty flags/related and add Omarchy intent tags. Safe to run on every open.
function enrichLibrary(library) {
  var base = normalizeLibrary(library)
  var index = libraryIndex(base)
  var out = []

  for (var i = 0; i < base.length; i++) {
    var entry = base[i]
    var tags = entry.tags.slice()
    var flags = entry.flags.slice()
    var related = entry.related.slice()
    var examples = entry.examples.slice()
    var isOmarchy = entry.sources.indexOf("omarchy") >= 0

    if (isOmarchy) {
      tags = uniqueStrings(tags.concat(intentTagsForOmarchy(entry.command, omarchyGroup(entry.command), entry.summary)))
      examples = withoutUsageShapeExamples(examples)
      if (!flags.length) {
        flags = flagsFromUsageExamples(entry)
      }
    }

    if (!flags.length && COMMON_FLAGS[entry.command]) {
      flags = COMMON_FLAGS[entry.command].map(function(f) {
        return { flag: f.flag, meaning: f.meaning }
      })
    }

    if (!related.length && COMMON_RELATED[entry.command]) {
      related = COMMON_RELATED[entry.command].slice()
    }
    if (!related.length && isOmarchy) {
      related = suggestOmarchyRelated(entry, index)
    }

    out.push(normalizeEntry({
      id: entry.id,
      command: entry.command,
      title: entry.title,
      summary: entry.summary,
      sources: entry.sources,
      tags: tags,
      danger: entry.danger,
      examples: examples,
      flags: flags,
      related: related,
      man: entry.man,
      starter: entry.starter
    }))
  }
  return out
}
