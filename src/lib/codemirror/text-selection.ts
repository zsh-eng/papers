import { Prec } from "@codemirror/state";
import { EditorView, layer, RectangleMarker } from "@codemirror/view";

/**
 * Custom selection drawing that only highlights actual text,
 * not extending to line edges like the default drawSelection.
 * This mimics Obsidian's selection behavior.
 *
 * Based on CodeMirror's drawSelection but using custom marker generation
 * that doesn't extend selections past the text content.
 * Link: https://github.com/codemirror/view/blob/main/src/draw-selection.ts
 */

// Selection layer - draws behind text
const selectionLayer = layer({
  above: false,
  markers(view) {
    const markers: RectangleMarker[] = [];

    for (const range of view.state.selection.ranges) {
      if (range.empty) continue;

      // Get line range for this selection
      const fromLine = view.state.doc.lineAt(range.from);
      const toLine = view.state.doc.lineAt(range.to);

      for (let lineNum = fromLine.number; lineNum <= toLine.number; lineNum++) {
        const line = view.state.doc.line(lineNum);

        // Calculate selection bounds on this line
        const selStart = Math.max(range.from, line.from);
        const selEnd = Math.min(range.to, line.to);

        // Skip empty selections on this line
        if (selStart >= selEnd) continue;

        // Get coordinates - these are viewport-relative
        const startCoords = view.coordsAtPos(selStart);
        const endCoords = view.coordsAtPos(selEnd);

        if (!startCoords || !endCoords) continue;

        // Convert to document-relative coordinates
        const contentRect = view.contentDOM.getBoundingClientRect();
        const left = startCoords.left - contentRect.left;
        const top = startCoords.top - contentRect.top;
        const width = endCoords.left - startCoords.left;
        const height = startCoords.bottom - startCoords.top;

        // Handle wrapped lines - if top positions differ significantly,
        // we need to draw multiple rectangles
        if (Math.abs(startCoords.top - endCoords.top) > 2) {
          // Selection spans multiple visual lines due to wrapping
          markers.push(
            ...getWrappedLineMarkers(view, selStart, selEnd, contentRect),
          );
        } else {
          markers.push(
            new RectangleMarker(
              "cm-selectionBackground",
              left,
              top,
              Math.max(width, 1),
              height,
            ),
          );
        }
      }
    }

    return markers;
  },
  update(update) {
    return update.docChanged || update.selectionSet || update.viewportChanged;
  },
  class: "cm-selectionLayer",
});

/**
 * Handle selections that span wrapped lines within a single document line
 */
function getWrappedLineMarkers(
  view: EditorView,
  from: number,
  to: number,
  contentRect: DOMRect,
): RectangleMarker[] {
  const markers: RectangleMarker[] = [];
  let pos = from;
  let segmentStart = from;
  let lastCoords = view.coordsAtPos(from);

  if (!lastCoords) return markers;

  while (pos <= to) {
    const coords = view.coordsAtPos(pos);
    if (!coords) {
      pos++;
      continue;
    }

    // Check if we've moved to a new visual line
    if (Math.abs(coords.top - lastCoords.top) > 2) {
      // Draw the previous segment
      const startCoords = view.coordsAtPos(segmentStart);
      const endCoords = view.coordsAtPos(pos - 1, 1); // bias to right side

      if (startCoords && endCoords) {
        markers.push(
          new RectangleMarker(
            "cm-selectionBackground",
            startCoords.left - contentRect.left,
            startCoords.top - contentRect.top,
            Math.max(endCoords.right - startCoords.left, 1),
            startCoords.bottom - startCoords.top,
          ),
        );
      }

      segmentStart = pos;
      lastCoords = coords;
    }

    pos++;
  }

  // Draw the final segment
  const startCoords = view.coordsAtPos(segmentStart);
  const endCoords = view.coordsAtPos(to);

  if (startCoords && endCoords) {
    markers.push(
      new RectangleMarker(
        "cm-selectionBackground",
        startCoords.left - contentRect.left,
        startCoords.top - contentRect.top,
        Math.max(endCoords.left - startCoords.left, 1),
        startCoords.bottom - startCoords.top,
      ),
    );
  }

  return markers;
}

// Hide native selection - adapted from CodeMirror's drawSelection
const hideNativeSelection = Prec.highest(
  EditorView.theme({
    ".cm-line": {
      "& ::selection, &::selection": {
        backgroundColor: "transparent !important",
      },
    },
  }),
);

// Selection background styling
const selectionTheme = EditorView.theme({
  ".cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--foreground) 20%, transparent)",
  },
});

export const textSelection = [
  selectionLayer,
  hideNativeSelection,
  selectionTheme,
];
