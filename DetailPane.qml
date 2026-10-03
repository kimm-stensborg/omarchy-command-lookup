import QtQuick
import qs.Commons
import qs.Ui
import "Model.js" as Model

// Beside the list: synopsis, clickable examples, flags, and related commands.
Item {
  id: root

  property var entry: null
  property var related: []
  property int exampleIndex: 0
  property int copiedIndex: -1
  property string queryText: ""
  property string fontFamily: Style.font.menuFamily
  property color foreground: Color.menu.text
  property color borderColor: Color.menu.border
  property color accent: Color.accent
  property color matchColor: Color.accent
  property color warningColor: Color.urgent
  property color selectedBackground: Color.menu.selectedBackground
  property var themeColors: ({})
  property color fallbackColor: Color.accent
  property string emptyHint: "Pick a command"

  signal exampleClicked(int index)
  signal relatedClicked(string id)

  readonly property int exampleCount: root.entry && root.entry.examples ? root.entry.examples.length : 0

  function colorFor(key) {
    return Model.sourceColor(key, root.themeColors, root.fallbackColor)
  }

  onEntryChanged: if (flick) flick.contentY = 0

  Rectangle {
    anchors.left: parent.left
    anchors.top: parent.top
    anchors.bottom: parent.bottom
    width: Style.normalBorderWidth
    color: Util.alpha(root.borderColor, 0.2)
  }

  Text {
    visible: !root.entry
    anchors.centerIn: parent
    textFormat: Text.PlainText
    text: root.emptyHint
    color: root.foreground
    opacity: 0.45
    font.family: root.fontFamily
    font.pixelSize: Style.font.caption
  }

  Flickable {
    id: flick
    anchors.fill: parent
    anchors.leftMargin: Style.space(16)
    anchors.rightMargin: Style.space(4)
    contentHeight: body.implicitHeight
    clip: true
    boundsBehavior: Flickable.StopAtBounds
    visible: !!root.entry
    onContentHeightChanged: flick.contentY = 0

    Column {
      id: body
      width: flick.width
      spacing: Style.space(14)

      Column {
        width: parent.width
        spacing: Style.space(4)

        Text {
          width: parent.width
          textFormat: Text.StyledText
          wrapMode: Text.Wrap
          text: root.entry ? Model.highlightHtml(root.entry.command, root.queryText, root.matchColor) : ""
          color: root.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.heading
        }

        Text {
          width: parent.width
          textFormat: Text.StyledText
          wrapMode: Text.Wrap
          text: root.entry ? Model.highlightHtml(root.entry.title, root.queryText, root.matchColor) : ""
          color: root.foreground
          opacity: 0.85
          font.family: root.fontFamily
          font.pixelSize: Style.font.body
        }

        Row {
          spacing: Style.space(6)
          Repeater {
            model: root.entry ? Model.sourceKeys(root.entry) : []
            Rectangle {
              required property string modelData
              readonly property color tone: root.colorFor(modelData)
              height: Math.max(Style.space(18), Style.font.caption + Style.space(6))
              width: badgeLabel.implicitWidth + Style.space(10)
              radius: height / 2
              color: Util.alpha(tone, 0.18)
              Text {
                id: badgeLabel
                anchors.centerIn: parent
                textFormat: Text.PlainText
                text: Model.sourceLabel(modelData)
                color: parent.tone
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
              }
            }
          }
          Rectangle {
            visible: !!(root.entry && root.entry.danger)
            height: Math.max(Style.space(18), Style.font.caption + Style.space(6))
            width: dangerLabel.implicitWidth + Style.space(10)
            radius: height / 2
            color: Util.alpha(root.warningColor, 0.2)
            Text {
              id: dangerLabel
              anchors.centerIn: parent
              textFormat: Text.PlainText
              text: root.entry ? Model.dangerLabel(root.entry.danger) : ""
              color: root.warningColor
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
            }
          }
        }
      }

      Text {
        width: parent.width
        textFormat: Text.PlainText
        wrapMode: Text.Wrap
        text: root.entry ? root.entry.summary : ""
        color: root.foreground
        opacity: 0.78
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        lineHeight: 1.25
      }

      Column {
        width: parent.width
        spacing: Style.space(6)
        visible: root.exampleCount > 0

        Text {
          textFormat: Text.PlainText
          text: "Examples"
          color: root.foreground
          opacity: 0.55
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
        }

        Repeater {
          model: root.entry ? root.entry.examples : []

          Rectangle {
            id: exCard
            required property var modelData
            required property int index
            readonly property bool selected: index === root.exampleIndex
            readonly property bool justCopied: index === root.copiedIndex
            width: body.width
            height: exCol.implicitHeight + Style.space(12)
            radius: Style.cornerRadius
            color: exCard.justCopied ? Util.alpha(root.accent, 0.22)
                 : (exCard.selected ? root.selectedBackground : Util.alpha(root.borderColor, 0.08))
            border.width: exCard.selected || exCard.justCopied ? Math.max(1, Style.space(1)) : 0
            border.color: exCard.justCopied ? root.accent : root.accent

            Column {
              id: exCol
              anchors.left: parent.left
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              anchors.leftMargin: Style.space(10)
              anchors.rightMargin: Style.space(10)
              spacing: Style.space(3)

              Row {
                width: parent.width
                spacing: Style.space(8)

                Text {
                  width: parent.width - (copiedHint.visible ? copiedHint.width + Style.space(8) : 0)
                  textFormat: Text.PlainText
                  wrapMode: Text.Wrap
                  text: modelData.label
                  color: root.foreground
                  opacity: 0.6
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.caption
                }

                Text {
                  id: copiedHint
                  visible: exCard.justCopied
                  textFormat: Text.PlainText
                  text: "Copied"
                  color: root.accent
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.caption
                }
              }

              Text {
                width: parent.width
                textFormat: Text.PlainText
                wrapMode: Text.Wrap
                text: modelData.cmd
                color: root.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.body
              }
            }

            MouseArea {
              anchors.fill: parent
              cursorShape: Qt.PointingHandCursor
              onClicked: root.exampleClicked(index)
            }
          }
        }
      }

      Column {
        width: parent.width
        spacing: Style.space(4)
        visible: root.entry && root.entry.flags && root.entry.flags.length > 0

        Text {
          textFormat: Text.PlainText
          text: "Useful flags"
          color: root.foreground
          opacity: 0.55
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
        }

        Repeater {
          model: root.entry ? root.entry.flags : []
          Row {
            required property var modelData
            width: body.width
            spacing: Style.space(8)
            Text {
              width: Style.space(72)
              textFormat: Text.PlainText
              text: modelData.flag
              color: root.accent
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
            }
            Text {
              width: body.width - Style.space(80)
              textFormat: Text.PlainText
              wrapMode: Text.Wrap
              text: modelData.meaning
              color: root.foreground
              opacity: 0.75
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
            }
          }
        }
      }

      Column {
        width: parent.width
        spacing: Style.space(4)
        visible: root.related && root.related.length > 0

        Text {
          textFormat: Text.PlainText
          text: "Related"
          color: root.foreground
          opacity: 0.55
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
        }

        Repeater {
          model: root.related
          Item {
            required property var modelData
            width: body.width
            height: relatedLabel.implicitHeight + Style.space(6)

            Text {
              id: relatedLabel
              anchors.left: parent.left
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              textFormat: Text.StyledText
              text: '<font color="' + root.accent + '">' + Model.escapeHtml(modelData.command)
                + '</font>'
                + ' — ' + Model.escapeHtml(modelData.title)
              color: root.foreground
              opacity: relatedHover.containsMouse ? 1 : 0.78
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
              elide: Text.ElideRight
            }

            MouseArea {
              id: relatedHover
              anchors.fill: parent
              hoverEnabled: true
              cursorShape: Qt.PointingHandCursor
              onClicked: root.relatedClicked(modelData.id)
            }
          }
        }
      }

      Text {
        visible: !!(root.entry && root.entry.man)
        width: parent.width
        textFormat: Text.PlainText
        wrapMode: Text.Wrap
        text: root.entry && root.entry.man
          ? "Shift+Enter opens man " + root.entry.man
          : ""
        color: root.foreground
        opacity: 0.45
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
      }
    }
  }
}
