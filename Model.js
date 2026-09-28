.pragma library

// Pure search and ranking for Command Lookup. Nothing here touches a file or
// a window, so `node test.js` covers it.

var SOURCES = ["linux", "arch", "omarchy"]
var MAX_RESULTS = 40
var STARTER_LIMIT = 24

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

function termVariants(term) {
  var out = [term]
  if (term.length > 3 && term.charAt(term.length - 1) === "s") out.push(term.slice(0, -1))
  else if (term.length > 2) out.push(term + "s")
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

    for (var t = 0; t < tags.length; t++) {
      if (tags[t] === term) score += 140
      else if (tags[t].indexOf(term) >= 0) score += 70
    }

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

function search(library, query, sources, frecency, limit) {
  var cap = limit > 0 ? limit : MAX_RESULTS
  var terms = words(query)
  var pool = []
  var list = library || []
  if (!anySourceOn(sources)) {
    return { results: [], meta: { total: 0, shown: 0, emptySources: true } }
  }

  for (var i = 0; i < list.length; i++) {
    var entry = list[i]
    if (!sourceAllowed(entry, sources)) continue
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

  var results = []
  for (var r = 0; r < pool.length && r < cap; r++) {
    var hit = pool[r].entry
    results.push({
      id: hit.id,
      command: hit.command,
      title: hit.title,
      summary: hit.summary,
      sources: hit.sources.slice(),
      danger: hit.danger,
      score: pool[r].score,
      used: pool[r].usedBoost > 0
    })
  }

  return {
    results: results,
    meta: {
      total: pool.length,
      shown: results.length,
      truncated: pool.length > results.length,
      emptySources: false,
      idle: terms.length === 0
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

function footerHints(hasSelection) {
  var hints = []
  if (hasSelection) {
    hints.push("⏎ copy example")
    hints.push("[ ] cycle")
    hints.push("⇧⏎ man")
  }
  hints.push("esc close")
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
        used: true
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
