import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import QtQuick
import qs.Commons
import qs.Ui
import "Model.js" as Model

// Command Lookup. Search line, source pills, result list, and an always-on
// detail pane. Enter / click an example copies it.
Item {
  id: root

  property string omarchyPath: Quickshell.env("OMARCHY_PATH")
  property var shell: null
  property var manifest: null

  readonly property string pluginId: "io.github.kimm-stensborg.command-lookup"
  readonly property string pluginDir: root.manifest && root.manifest.__sourceDir
    ? String(root.manifest.__sourceDir)
    : Quickshell.env("HOME") + "/.config/omarchy/plugins/" + root.pluginId
  readonly property string home: Quickshell.env("HOME")
  readonly property string stateDir: root.home + "/.local/state/omarchy"
  readonly property string frecencyPath: root.stateDir + "/command-lookup.json"
  readonly property string sourcesPath: root.stateDir + "/command-lookup-sources.json"
  readonly property string themePath: root.home + "/.local/state/omarchy/current/theme/colors.toml"

  property bool opened: false
  property string queryText: ""
  property string topicId: ""
  property int selectedIndex: 0
  property int exampleIndex: 0
  property int copiedIndex: -1
  property var library: []
  property var baseLibrary: []
  property var results: []
  property var meta: ({})
  property var sources: Model.defaultSources()
  property var frecency: ({})
  property string statusMessage: ""
  property bool libraryReady: false
  property bool omarchyCatalogPending: false
  property var themeColors: ({})

  readonly property var current: root.selectedIndex >= 0 && root.selectedIndex < root.results.length
    ? root.results[root.selectedIndex] : null
  readonly property bool currentIsTopic: !!(root.current && root.current.kind === "topic")
  readonly property var currentEntry: root.currentIsTopic || !root.current
    ? null
    : Model.findById(root.library, root.current.id)
  readonly property var related: Model.relatedEntries(root.library, root.currentEntry, root.sources, 6)
  readonly property color matchColor: root.themeColors.yellow || root.accent
  readonly property color warningColor: root.themeColors.red || Color.urgent

  readonly property color background: Color.menu.background
  readonly property color foreground: Color.menu.text
  readonly property color borderColor: Color.menu.border
  readonly property var borderSpec: Border.surfaceSpec("menu", "border", borderColor, Math.max(1, Style.space(2)))
  readonly property color scrim: Color.menu.scrim
  readonly property color selectedBackground: Color.menu.selectedBackground
  readonly property color selectedText: Color.menu.selectedText
  readonly property color accent: Color.accent
  readonly property int cornerRadius: Style.cornerRadius
  readonly property string fontFamily: Style.font.menuFamily
  readonly property int contentMargin: Style.spacing.panelPadding
  readonly property int contentSpacing: Style.spacing.md
  readonly property int headerHeight: Math.max(Style.space(34), Style.font.heading + Style.spacing.controlPaddingY * 2)
  readonly property int footerHeight: Math.max(Style.space(20), Style.font.caption + Style.space(6))
  readonly property int rowHeight: Math.max(Style.space(34), Style.font.body + Style.space(16))
  readonly property int rowInset: Style.space(10)
  readonly property int cardWidth: Math.min(Style.space(1100), panel.width - Style.gapsOut * 2)
  readonly property int cardHeight: Math.min(Style.space(640), panel.height - Style.gapsOut * 2)
  readonly property int peekWidth: Style.space(380)

  function sourceTone(key) {
    return Model.sourceColor(key, root.themeColors, root.accent)
  }

  function open(payloadJson) {
    var payload = ({})
    try { payload = JSON.parse(payloadJson || "{}") } catch (e) { payload = ({}) }

    root.opened = true
    root.selectedIndex = 0
    root.exampleIndex = 0
    root.copiedIndex = -1
    root.statusMessage = ""
    root.topicId = ""
    root.sources = Model.parseSavedSources(sourcesFile.text())
    root.frecency = Model.parseFrecency(frecencyFile.text())
    root.themeColors = Model.themeColors(themeFile.text())
    root.queryText = ""
    if (payload.query) root.queryText = String(payload.query)
    if (payload.topic) root.topicId = String(payload.topic)
    if (payload.sources) root.sources = Model.normalizeSources(payload.sources)
    root.ensureLibrary()
    root.fetchOmarchyCatalog()
    root.refresh()
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
  }

  function close() {
    root.opened = false
  }

  function ping() { return "ok" }

  function ensureLibrary() {
    if (root.libraryReady && root.library.length) return
    libraryFile.reload()
  }

  function applyLibrary(text) {
    var data = null
    try { data = JSON.parse(text) } catch (e) { data = null }
    var list = Array.isArray(data) ? data : (data && data.commands ? data.commands : [])
    root.baseLibrary = Model.normalizeLibrary(list)
    root.library = Model.enrichLibrary(root.baseLibrary)
    root.libraryReady = root.library.length > 0
    root.refresh()
    root.fetchOmarchyCatalog()
  }

  // Pull the live Omarchy CLI catalog and merge it over the shipped library.
  // Curated titles/tags/examples win; missing routes are appended.
  function fetchOmarchyCatalog() {
    if (omarchyCatalogProc.running) {
      root.omarchyCatalogPending = true
      return
    }
    omarchyCatalogProc.command = ["omarchy", "commands", "--json"]
    omarchyCatalogProc.running = true
  }

  function applyOmarchyCatalog(text) {
    var live = Model.fromOmarchyCommandsJson(text)
    if (!live.length) return
    root.library = Model.enrichLibrary(Model.mergeLibraries(root.baseLibrary, live))
    root.libraryReady = root.library.length > 0
    root.refresh()
  }

  function setQuery(next) {
    root.queryText = next
    // Topic drill-in stays while typing; Esc clears the topic.
    root.selectedIndex = 0
    root.exampleIndex = 0
    root.copiedIndex = -1
    pointerGate.reset()
    root.refresh()
  }

  function setTopic(id) {
    root.topicId = id ? String(id) : ""
    root.queryText = ""
    root.selectedIndex = 0
    root.exampleIndex = 0
    root.copiedIndex = -1
    pointerGate.reset()
    root.refresh()
  }

  function togglePill(key) {
    root.sources = Model.toggleSource(root.sources, key)
    sourcesFile.setText(Model.serializeSources(root.sources))
    root.selectedIndex = 0
    root.exampleIndex = 0
    root.copiedIndex = -1
    pointerGate.reset()
    root.refresh()
  }

  function refresh() {
    var keepId = root.current ? root.current.id : ""
    var keepExample = root.exampleIndex
    var found = Model.search(root.library, root.queryText, root.sources, root.frecency, Model.MAX_RESULTS, root.topicId)
    root.results = found.results
    root.meta = found.meta
    var at = keepId ? Model.indexOfId(root.results, keepId) : -1
    if (at >= 0) {
      root.selectedIndex = at
      root.exampleIndex = keepExample
    } else {
      root.selectedIndex = root.results.length ? 0 : 0
      root.exampleIndex = 0
    }
  }

  function activateSelection() {
    if (root.currentIsTopic) {
      root.setTopic(root.current.topicId)
      return
    }
    root.copyExample(root.exampleIndex)
  }

  function move(delta) {
    if (!root.results.length) return
    root.selectAbsolute(root.selectedIndex + delta)
  }

  function selectAbsolute(index) {
    if (!root.results.length) {
      root.selectedIndex = 0
      return
    }
    var next = Math.max(0, Math.min(root.results.length - 1, index))
    root.selectedIndex = next
    root.exampleIndex = 0
    root.copiedIndex = -1
    resultList.positionViewAtIndex(next, ListView.Contain)
  }

  // Follow a related link: enable its sources if needed, land on it in the
  // list (narrowing the query to its command when it was not already a hit).
  function jumpToRelated(id) {
    var entry = Model.findById(root.library, id)
    if (!entry) return

    var nextSources = Model.openSourcesFor(entry, root.sources)
    var sourcesChanged = nextSources.linux !== root.sources.linux
      || nextSources.arch !== root.sources.arch
      || nextSources.omarchy !== root.sources.omarchy
    if (sourcesChanged) {
      root.sources = nextSources
      sourcesFile.setText(Model.serializeSources(root.sources))
    }

    root.topicId = ""
    var at = Model.indexOfId(root.results, entry.id)
    if (at < 0 || sourcesChanged) {
      root.queryText = entry.command
      root.copiedIndex = -1
      var found = Model.search(root.library, root.queryText, root.sources, root.frecency, Model.MAX_RESULTS, "")
      root.results = found.results
      root.meta = found.meta
      at = Model.indexOfId(root.results, entry.id)
    }
    if (at < 0) at = 0
    root.selectAbsolute(at)
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
  }

  function moveExample(delta) {
    var entry = root.currentEntry
    var count = entry && entry.examples ? entry.examples.length : 0
    if (count <= 0) return
    var next = root.exampleIndex + delta
    if (next < 0) next = count - 1
    if (next >= count) next = 0
    root.exampleIndex = next
    root.copiedIndex = -1
  }

  // Copy the highlighted example. Does not reshuffle the list mid-browse —
  // frecency applies on the next search / open.
  function copyExample(index) {
    if (root.currentIsTopic) {
      root.setTopic(root.current.topicId)
      return
    }
    var entry = root.currentEntry
    if (!entry) return
    var idx = index >= 0 ? index : root.exampleIndex
    var text = Model.copyTarget(entry, idx)
    if (!text) return
    root.exampleIndex = idx
    root.copiedIndex = idx
    copyProc.command = ["wl-copy", "--", text]
    copyProc.running = false
    copyProc.running = true
    root.frecency = Model.recordUse(root.frecency, entry.id, Date.now())
    frecencyFile.setText(Model.serializeFrecency(root.frecency))
    root.results = Model.markUsed(root.results, entry.id)
    root.statusMessage = "Copied"
    statusTimer.restart()
    copiedTimer.restart()
  }

  function openMan() {
    if (root.currentIsTopic) return
    var entry = root.currentEntry
    if (!entry || !entry.man) {
      root.statusMessage = "No man page for this one"
      statusTimer.restart()
      return
    }
    manProc.command = ["xdg-terminal-exec", "man", entry.man]
    manProc.running = false
    manProc.running = true
    root.frecency = Model.recordUse(root.frecency, entry.id, Date.now())
    frecencyFile.setText(Model.serializeFrecency(root.frecency))
    root.close()
  }

  function metaText() {
    if (!root.libraryReady) return "Loading library…"
    if (root.meta && root.meta.emptySources) return "Turn on a source pill"
    if (root.statusMessage) return root.statusMessage
    var total = root.meta && root.meta.total !== undefined ? root.meta.total : 0
    var shown = root.meta && root.meta.shown !== undefined ? root.meta.shown : 0
    if (root.meta && root.meta.browsingTopics) {
      return shown ? ("Topics · " + shown) : "Nothing in these sources"
    }
    if (root.meta && root.meta.didYouMean) {
      return "Did you mean…"
    }
    if (root.meta && root.meta.idle && root.meta.topicLabel) {
      return root.meta.topicLabel + " · " + shown
    }
    if (root.meta && root.meta.idle) {
      return shown ? ("Browse · " + shown) : "Nothing in these sources"
    }
    if (!shown) return "Nothing matches"
    if (root.meta && root.meta.truncated) return "Showing " + shown + " of " + total
    return shown + " match" + (shown === 1 ? "" : "es")
  }

  function pillOn(key) {
    return !!(root.sources && root.sources[key])
  }

  FileView {
    id: libraryFile
    path: root.pluginDir + "/commands.json"
    blockLoading: true
    watchChanges: true
    onLoaded: root.applyLibrary(text())
    onLoadFailed: function() {
      root.library = []
      root.libraryReady = false
      root.statusMessage = "Missing commands.json"
    }
  }

  FileView {
    id: frecencyFile
    path: root.frecencyPath
    blockLoading: false
    watchChanges: false
    atomicWrites: true
    printErrors: false
  }

  FileView {
    id: sourcesFile
    path: root.sourcesPath
    blockLoading: false
    watchChanges: false
    atomicWrites: true
    printErrors: false
  }

  FileView {
    id: themeFile
    path: root.themePath
    watchChanges: true
    onLoaded: root.themeColors = Model.themeColors(text())
  }

  Process {
    id: copyProc
    stdout: StdioCollector { waitForEnd: true }
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: if (text.trim().length) console.warn(root.pluginId + " copy:", text.trim())
    }
  }

  Process {
    id: manProc
    stdout: StdioCollector { waitForEnd: true }
    stderr: StdioCollector { waitForEnd: true }
  }

  Process {
    id: omarchyCatalogProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applyOmarchyCatalog(text)
    }
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: if (text.trim().length) console.warn(root.pluginId + " omarchy catalog:", text.trim())
    }
    onExited: {
      if (root.omarchyCatalogPending) {
        root.omarchyCatalogPending = false
        Qt.callLater(root.fetchOmarchyCatalog)
      }
    }
  }

  Timer {
    id: statusTimer
    interval: 1800
    onTriggered: root.statusMessage = ""
  }

  Timer {
    id: copiedTimer
    interval: 1400
    onTriggered: root.copiedIndex = -1
  }

  PointerMoveGate {
    id: pointerGate
    referenceItem: card
  }

  PanelWindow {
    id: panel
    visible: root.opened
    anchors { top: true; bottom: true; left: true; right: true }
    color: "transparent"
    WlrLayershell.namespace: "omarchy-command-lookup"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
    exclusionMode: ExclusionMode.Ignore

    Rectangle {
      anchors.fill: parent
      color: root.scrim
    }

    MouseArea {
      anchors.fill: parent
      onClicked: root.close()
    }

    BorderSurface {
      id: card
      width: root.cardWidth
      height: root.cardHeight
      radius: root.cornerRadius
      anchors.centerIn: parent
      color: root.background
      borderSpec: root.borderSpec
      padding: root.contentMargin

      MouseArea { anchors.fill: parent; onClicked: {} }

      Item {
        id: keyCatcher
        anchors.fill: parent
        focus: true
        Keys.priority: Keys.BeforeItem

        Keys.onPressed: function(event) {
          if (event.key === Qt.Key_Escape) {
            if (root.queryText) root.setQuery("")
            else if (root.topicId) root.setTopic("")
            else root.close()
            event.accepted = true
          } else if (event.key === Qt.Key_Up) {
            root.move(-1)
            event.accepted = true
          } else if (event.key === Qt.Key_Down) {
            root.move(1)
            event.accepted = true
          } else if (event.key === Qt.Key_BracketLeft || event.key === Qt.Key_BraceLeft) {
            root.moveExample(-1)
            event.accepted = true
          } else if (event.key === Qt.Key_BracketRight || event.key === Qt.Key_BraceRight) {
            root.moveExample(1)
            event.accepted = true
          } else if (event.key === Qt.Key_Tab || event.key === Qt.Key_Backtab) {
            var back = event.key === Qt.Key_Backtab || (event.modifiers & Qt.ShiftModifier)
            root.moveExample(back ? -1 : 1)
            event.accepted = true
          } else if (event.key === Qt.Key_PageUp) {
            root.selectAbsolute(root.selectedIndex - 6); event.accepted = true
          } else if (event.key === Qt.Key_PageDown) {
            root.selectAbsolute(root.selectedIndex + 6); event.accepted = true
          } else if (event.key === Qt.Key_Home) {
            root.selectAbsolute(0); event.accepted = true
          } else if (event.key === Qt.Key_End) {
            root.selectAbsolute(root.results.length - 1); event.accepted = true
          } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
            if (event.modifiers & Qt.ShiftModifier) root.openMan()
            else root.activateSelection()
            event.accepted = true
          } else if ((event.modifiers & Qt.AltModifier) && event.key === Qt.Key_1) {
            root.togglePill("linux"); event.accepted = true
          } else if ((event.modifiers & Qt.AltModifier) && event.key === Qt.Key_2) {
            root.togglePill("arch"); event.accepted = true
          } else if ((event.modifiers & Qt.AltModifier) && event.key === Qt.Key_3) {
            root.togglePill("omarchy"); event.accepted = true
          } else if (Util.editsFilter(event, root.queryText)) {
            root.setQuery(Util.editedFilter(event, root.queryText))
            event.accepted = true
          } else if (event.key === Qt.Key_Backspace) {
            root.setQuery(root.queryText.slice(0, -1))
            event.accepted = true
          } else if (event.text && event.text.length === 1
                     && event.text.charCodeAt(0) >= 32 && event.text.charCodeAt(0) !== 127
                     && !(event.modifiers & (Qt.ControlModifier | Qt.AltModifier))) {
            root.setQuery(root.queryText + event.text)
            event.accepted = true
          }
        }
      }

      Column {
        anchors.fill: parent
        anchors.topMargin: card.contentTopInset
        anchors.rightMargin: card.contentRightInset
        anchors.bottomMargin: card.contentBottomInset
        anchors.leftMargin: card.contentLeftInset
        spacing: root.contentSpacing

        Item {
          id: headerLine
          width: parent.width
          height: root.headerHeight

          Text {
            id: queryLabel
            textFormat: Text.PlainText
            anchors.left: parent.left
            anchors.verticalCenter: parent.verticalCenter
            width: Math.max(0, headerLine.width - metaLine.width - Style.space(24))
            text: root.queryText
              || (root.topicId && root.meta && root.meta.topicLabel
                  ? ("Search in " + root.meta.topicLabel + "…")
                  : "Search or pick a topic… delete folders, mute mic")
            color: root.foreground
            opacity: root.queryText ? 1 : 0.58
            font.family: root.fontFamily
            font.pixelSize: Style.font.heading
            elide: Text.ElideLeft
          }

          Text {
            id: metaLine
            textFormat: Text.PlainText
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            text: root.metaText()
            color: root.statusMessage === "Copied" ? root.accent : root.foreground
            opacity: root.statusMessage === "Copied" ? 0.95 : 0.5
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
          }
        }

        Row {
          id: pillRow
          spacing: Style.space(8)
          width: parent.width

          Repeater {
            model: [
              { key: "linux", label: "Linux" },
              { key: "arch", label: "Arch" },
              { key: "omarchy", label: "Omarchy" }
            ]

            Rectangle {
              id: pill
              required property var modelData
              readonly property bool on: root.pillOn(modelData.key)
              readonly property color tone: root.sourceTone(modelData.key)
              height: Math.max(Style.space(26), Style.font.caption + Style.space(12))
              width: pillLabel.implicitWidth + Style.space(18)
              radius: height / 2
              color: pill.on ? Util.alpha(pill.tone, 0.22) : "transparent"
              border.width: Style.normalBorderWidth
              border.color: pill.on ? pill.tone : Util.alpha(root.borderColor, 0.45)

              Text {
                id: pillLabel
                anchors.centerIn: parent
                textFormat: Text.PlainText
                text: modelData.label
                color: pill.on ? pill.tone : root.foreground
                opacity: pill.on ? 1 : 0.65
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
              }

              MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: root.togglePill(modelData.key)
              }
            }
          }
        }

        Item {
          width: parent.width
          height: Math.max(0, parent.height - root.headerHeight - pillRow.height
            - root.footerHeight - root.contentSpacing * 3)

          ListView {
            id: resultList
            anchors.fill: parent
            anchors.leftMargin: -root.rowInset
            anchors.rightMargin: root.peekWidth + Style.space(12)
            model: root.results.length
            clip: true
            spacing: Style.space(2)
            boundsBehavior: Flickable.StopAtBounds

            delegate: Rectangle {
              id: row
              required property int index
              readonly property var entry: root.results[index]
              readonly property bool hasCursor: index === root.selectedIndex
              readonly property string primarySource: row.entry && row.entry.sources && row.entry.sources.length
                ? row.entry.sources[0] : "linux"
              readonly property color tone: root.sourceTone(row.primarySource)

              width: ListView.view.width
              height: row.entry && (row.entry.kind === "topic" || (root.meta && root.meta.didYouMean))
                ? root.rowHeight + Style.space(14)
                : root.rowHeight
              radius: root.cornerRadius
              color: row.hasCursor ? root.selectedBackground : "transparent"

              Rectangle {
                anchors.left: parent.left
                anchors.leftMargin: Style.space(2)
                anchors.verticalCenter: parent.verticalCenter
                width: Style.space(3)
                height: parent.height - Style.space(10)
                radius: width / 2
                color: row.tone
                opacity: row.hasCursor ? 1 : 0.55
              }

              Column {
                anchors.left: parent.left
                anchors.leftMargin: root.rowInset + Style.space(6)
                anchors.right: badges.left
                anchors.rightMargin: Style.space(8)
                anchors.verticalCenter: parent.verticalCenter
                spacing: Style.space(1)

                Text {
                  id: cmdText
                  width: parent.width
                  textFormat: Text.StyledText
                  text: row.entry
                    ? (row.entry.kind === "topic"
                        ? row.entry.command
                        : Model.highlightHtml(row.entry.command, root.queryText, root.matchColor))
                    : ""
                  color: row.hasCursor ? root.selectedText : root.foreground
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.body
                  elide: Text.ElideRight
                }

                Text {
                  width: parent.width
                  visible: !!(row.entry && (row.entry.kind === "topic" || (root.meta && root.meta.didYouMean)))
                  textFormat: Text.PlainText
                  text: row.entry
                    ? (row.entry.kind === "topic"
                        ? row.entry.summary
                        : row.entry.title)
                    : ""
                  color: row.hasCursor ? root.selectedText : root.foreground
                  opacity: 0.55
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.caption
                  elide: Text.ElideRight
                }
              }

              Row {
                id: badges
                anchors.right: parent.right
                anchors.rightMargin: root.rowInset
                anchors.verticalCenter: parent.verticalCenter
                spacing: Style.space(6)

                Text {
                  visible: !!(row.entry && row.entry.kind === "topic")
                  textFormat: Text.PlainText
                  text: row.entry && row.entry.topicCount !== undefined ? String(row.entry.topicCount) : ""
                  color: root.accent
                  opacity: row.hasCursor ? 0.95 : 0.7
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.caption
                }

                Text {
                  visible: !!(row.entry && row.entry.danger)
                  textFormat: Text.PlainText
                  text: "!"
                  color: root.warningColor
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.body
                }

                Text {
                  visible: !!(row.entry && row.entry.used)
                  textFormat: Text.PlainText
                  text: "•"
                  color: root.accent
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.body
                }

                Repeater {
                  model: row.entry && row.entry.kind !== "topic" ? Model.sourceKeys(row.entry) : []
                  Text {
                    required property string modelData
                    textFormat: Text.PlainText
                    text: Model.sourceLabel(modelData)
                    color: root.sourceTone(modelData)
                    opacity: row.hasCursor ? 0.95 : 0.7
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.caption
                  }
                }
              }

              MouseArea {
                anchors.fill: parent
                hoverEnabled: true
                onPositionChanged: function(mouse) {
                  if (pointerGate.shouldIgnore(mouse)) return
                  if (root.selectedIndex !== row.index) {
                    root.selectedIndex = row.index
                    root.exampleIndex = 0
                    root.copiedIndex = -1
                  }
                }
                onClicked: {
                  root.selectedIndex = row.index
                  root.exampleIndex = 0
                  root.copiedIndex = -1
                }
              }
            }
          }

          DetailPane {
            id: detailPane
            anchors.top: parent.top
            anchors.bottom: parent.bottom
            anchors.right: parent.right
            width: root.peekWidth
            entry: root.currentEntry
            related: root.related
            exampleIndex: root.exampleIndex
            copiedIndex: root.copiedIndex
            queryText: root.queryText
            emptyHint: root.currentIsTopic
              ? ((root.current && root.current.summary) || "Press Enter to browse this topic")
              : ((root.meta && root.meta.didYouMean)
                  ? "Close match — Enter copies the example"
                  : "Pick a command")
            fontFamily: root.fontFamily
            foreground: root.foreground
            borderColor: root.borderColor
            accent: root.accent
            matchColor: root.matchColor
            warningColor: root.warningColor
            selectedBackground: root.selectedBackground
            themeColors: root.themeColors
            fallbackColor: root.accent
            onExampleClicked: function(index) { root.copyExample(index) }
            onRelatedClicked: function(id) { root.jumpToRelated(id) }
          }

          Text {
            visible: root.libraryReady && root.results.length === 0
            anchors.centerIn: parent
            anchors.horizontalCenterOffset: -root.peekWidth / 2
            textFormat: Text.PlainText
            text: root.meta && root.meta.emptySources
              ? "Enable Linux, Arch or Omarchy"
              : (root.queryText ? "Nothing matches — try fewer words" : "No commands in these sources")
            color: root.foreground
            opacity: 0.45
            font.family: root.fontFamily
            font.pixelSize: Style.font.body
          }
        }

        Text {
          width: parent.width
          height: root.footerHeight
          textFormat: Text.PlainText
          verticalAlignment: Text.AlignVCenter
          text: Model.footerHints(!!root.currentEntry || root.currentIsTopic, root.meta).join("   ")
          color: root.foreground
          opacity: 0.45
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          elide: Text.ElideRight
        }
      }
    }
  }
}
