# Command Lookup

**Search and learn Linux, Arch, and Omarchy commands from a keyboard overlay.**

Type what you want to do (“delete folders”, “mute mic”, “change theme”), or
browse by topic when the search line is empty. Copy an example with Enter.
Think task-first, not man-page-first.

| | |
|---|---|
| **Version** | 0.2.0 |
| **Id** | `io.github.kimm-stensborg.command-lookup` |
| **Shortcut** | `SUPER + SHIFT + C` (via `install.sh`) |

## Install

```bash
omarchy plugin add https://github.com/kimm-stensborg/omarchy-command-lookup.git --enable --yes
~/.config/omarchy/plugins/io.github.kimm-stensborg.command-lookup/install.sh
```

`install.sh` enables the plugin and offers a shortcut (default
`SUPER + SHIFT + C`, or the next free candidate).

## Use

| Key | Action |
|-----|--------|
| *(empty query)* | Browse topics — Enter opens one |
| Type | Search commands, titles, tags, and examples |
| ↑ ↓ | Move selection |
| Enter | Open topic, or copy the highlighted example |
| Click example | Copy that example (shows **Copied**) |
| Click related | Jump to that command (enables its source pill if needed) |
| `[` `]` / Tab | Cycle examples |
| Shift+Enter | Open `man` for this command (when available) |
| Alt+1 / 2 / 3 | Toggle Linux / Arch / Omarchy |
| Esc | Clear query → leave topic → close |

Misspelled or unknown queries show **Did you mean…** close matches instead of
an empty list.

Summon with a prefilled query or topic:

```bash
omarchy-shell shell summon io.github.kimm-stensborg.command-lookup '{"query":"show my ip"}'
omarchy-shell shell summon io.github.kimm-stensborg.command-lookup '{"topic":"network"}'
```

## Sources

Pills filter the library. Search only runs in the sources you leave on.
Choices are remembered in `~/.local/state/omarchy/command-lookup-sources.json`.

| Pill | What you get |
|------|----------------|
| Linux | Everyday CLI: files, text, network, processes, systemd, git basics |
| Arch | pacman, AUR helpers, mirrors, Btrfs/snapper, initramfs |
| Omarchy | Live catalog from `omarchy commands --json`, plus curated titles/tags |

Omarchy rows refresh each time the overlay opens. Curated copy (title, tags,
examples, related) wins on overlap; new CLI routes are appended. Offline, the
shipped library is used as-is.

```bash
node sync-omarchy.js   # refresh shipped Omarchy rows from the live CLI
node test.js           # Model + library checks
```

## Topics

Empty query shows topics with counts for the active source pills:

Files & folders · Text & search · Network · Processes · System & services ·
Packages · Git · Theme & look · Capture & share · Desktop & Omarchy

## Detail pane

- Short synopsis aimed at newcomers
- Source badges and a danger mark when needed
- Copyable examples (Enter copies the highlighted one)
- Useful flags (including Omarchy CLI args)
- Related commands
- Hint for Shift+Enter → man page

## Ranking

- Intent tags and synonyms so natural phrases hit the right rows
- Exact command name and title matches rank higher
- Commands you copy often float up (frecency in
  `~/.local/state/omarchy/command-lookup.json`)
- Empty query browses topics; inside a topic, starters and frecency lead

## Files

| File | Role |
|------|------|
| `Commands.qml` | Overlay UI |
| `DetailPane.qml` | Right-hand details |
| `Model.js` | Search, topics, fuzzy suggest, Omarchy merge |
| `commands.json` | Shipped library |
| `sync-omarchy.js` | Rewrite Omarchy rows from the live CLI |
| `install.sh` | Enable + bind shortcut |
| `test.js` | Model + library checks |
| `CHANGELOG.md` | Release notes |

## Keys in `commands.json`

| Key | Meaning |
|-----|---------|
| `id` | Stable id |
| `command` | What you type |
| `title` | Task-oriented label |
| `summary` | Beginner synopsis |
| `sources` | `linux` / `arch` / `omarchy` |
| `tags` | Intent words for search |
| `danger` | `null`, `medium`, or `high` |
| `examples` | `{ label, cmd }` list |
| `flags` | `{ flag, meaning }` list |
| `related` | Other ids or command names |
| `man` | Man page name, or null |
| `starter` | Prefer when browsing inside a topic |
