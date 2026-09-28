# Command Lookup

Search and learn Linux, Arch, and Omarchy commands from a keyboard overlay.

One search line, three source pills, a result list, and a detail pane for
examples you can copy. Think “what do I type to delete a folder?” rather than
memorizing man pages.

## Install

```bash
omarchy plugin add <git-url> --enable --yes
~/.config/omarchy/plugins/io.github.kimm-stensborg.command-lookup/install.sh
```

`install.sh` enables the plugin and offers a shortcut (default
`SUPER + SHIFT + C`).

## Use

| Key | Action |
|-----|--------|
| Type | Search commands, titles, tags, and examples |
| ↑ ↓ | Move selection |
| Enter | Copy the highlighted example |
| Click example | Copy that example (shows **Copied**) |
| Click related | Jump to that command (enables its source pill if needed) |
| `[` `]` / Tab | Cycle examples |
| Shift+Enter | Open `man` for this command (when available) |
| Alt+1 / 2 / 3 | Toggle Linux / Arch / Omarchy |
| Esc | Clear query, then close |

The detail pane is always open. Most-used matches for your query and filters
sort first.

Summon with a prefilled query:

```bash
omarchy-shell shell summon io.github.kimm-stensborg.command-lookup '{"query":"show my ip"}'
```

## Sources

Pills filter the library. Search only runs in the sources you leave on.
Choices are remembered in `~/.local/state/omarchy/command-lookup-sources.json`.

| Pill | What you get |
|------|----------------|
| Linux | Everyday CLI: files, text, network, processes, systemd, git basics |
| Arch | pacman, AUR helpers, mirrors, Btrfs/snapper, initramfs |
| Omarchy | `omarchy theme`, `pkg`, `capture`, `reminder`, bar, plugins, … |

## Detail pane

For the selected command:

- Short synopsis aimed at newcomers
- Source badges and a danger mark when needed
- Copyable examples (Enter copies the highlighted one)
- Common flags
- Related commands
- Hint for Shift+Enter → man page

## Ranking

- Intent tags so “delete folders” and “show my ip” hit the right rows
- Exact command name and title matches rank higher
- Commands you copy often float up (frecency in
  `~/.local/state/omarchy/command-lookup.json`)
- Empty query shows curated starters from the active sources

## Files

| File | Role |
|------|------|
| `Commands.qml` | Overlay UI |
| `DetailPane.qml` | Right-hand details |
| `Model.js` | Search, ranking, highlights |
| `commands.json` | The library (~250 entries) |
| `install.sh` | Enable + bind shortcut |
| `test.js` | Model + library checks |

```bash
node test.js
```

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
| `starter` | Show when the query is empty |
