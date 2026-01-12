import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";

// =============================================================================
// WIDGET CLASSES
// =============================================================================

/**
 * Bullet point widget - renders "•" for list items
 * The indentation is handled by line decorations, not the widget itself
 */
class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-list-bullet";
    span.textContent = "•";
    return span;
  }

  eq() {
    return true;
  }
}

/**
 * Link icon widget - inline SVG external link icon
 */
class LinkIconWidget extends WidgetType {
  url: string;

  constructor(url: string) {
    super();
    this.url = url;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-link-icon";
    span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
    span.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(this.url, "_blank", "noopener,noreferrer");
    });
    return span;
  }

  eq(other: LinkIconWidget) {
    return this.url === other.url;
  }
}

/**
 * Horizontal rule widget - renders a thin horizontal line
 */
class HorizontalRuleWidget extends WidgetType {
  toDOM() {
    const div = document.createElement("div");
    div.className = "cm-hr-line";
    return div;
  }

  eq() {
    return true;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if the cursor is within the given range (inclusive)
 */
function isCursorInRange(
  cursorPos: number,
  start: number,
  end: number,
): boolean {
  return cursorPos >= start && cursorPos <= end;
}

/**
 * Get the line number for a given position
 */
function getLineAt(view: EditorView, pos: number): number {
  return view.state.doc.lineAt(pos).number;
}

/**
 * Check if cursor is on the same line as the given position
 */
function isCursorOnLine(
  view: EditorView,
  cursorPos: number,
  pos: number,
): boolean {
  return getLineAt(view, cursorPos) === getLineAt(view, pos);
}

/**
 * Calculate list indent level by counting parent ListItem nodes
 */
function getListIndentLevel(node: {
  parent: { name: string; parent: unknown } | null;
}): number {
  let level = 0;
  let current: { name: string; parent: unknown } | null = node.parent;
  while (current) {
    if (current.name === "ListItem") {
      level++;
    }
    current = current.parent as { name: string; parent: unknown } | null;
  }
  return Math.max(0, level - 1); // -1 because the first ListItem doesn't need indent
}

// =============================================================================
// DECORATION FACTORIES
// =============================================================================

const hiddenDecoration = Decoration.replace({});

const headingDecorations: Record<number, Decoration> = {
  1: Decoration.mark({ class: "cm-heading cm-heading-1" }),
  2: Decoration.mark({ class: "cm-heading cm-heading-2" }),
  3: Decoration.mark({ class: "cm-heading cm-heading-3" }),
  4: Decoration.mark({ class: "cm-heading cm-heading-4" }),
  5: Decoration.mark({ class: "cm-heading cm-heading-5" }),
  6: Decoration.mark({ class: "cm-heading cm-heading-6" }),
};

const strongDecoration = Decoration.mark({ class: "cm-strong" });
const emphasisDecoration = Decoration.mark({ class: "cm-em" });
const inlineCodeDecoration = Decoration.mark({ class: "cm-inline-code" });
const blockquoteDecoration = Decoration.mark({ class: "cm-blockquote" });
const blockquoteLineDecoration = Decoration.line({
  class: "cm-blockquote-line",
});
const codeBlockLineDecoration = Decoration.line({
  class: "cm-code-block-line",
});
const formattingMarkDecoration = Decoration.mark({
  class: "cm-formatting-mark",
});

// =============================================================================
// MAIN VIEW PLUGIN
// =============================================================================

/**
 * PERFORMANCE NOTE: If decoration updates become sluggish with large documents,
 * consider adding:
 * 1. Debounce on update() - delay rebuild by ~50ms during rapid typing
 * 2. Viewport-only decorations - only decorate visible lines using view.viewport
 * 3. Incremental updates - only rebuild decorations in changed regions
 * 4. Memoization - cache decorations for unchanged regions
 * Current implementation rebuilds all decorations on every change for simplicity.
 */

class ObsidianModePlugin {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const cursor = view.state.selection.main.head;
    const doc = view.state.doc;

    // Track processed ranges to avoid duplicate decorations
    const processedRanges = new Set<string>();

    // Collect all decorations first, then sort by position
    const decorations: Array<{
      from: number;
      to: number;
      decoration: Decoration;
    }> = [];

    const addDecoration = (
      from: number,
      to: number,
      decoration: Decoration,
    ) => {
      const key = `${from}-${to}-${decoration.spec?.class || "replace"}`;
      if (
        !processedRanges.has(key) &&
        from < to &&
        from >= 0 &&
        to <= doc.length
      ) {
        processedRanges.add(key);
        decorations.push({ from, to, decoration });
      }
    };

    const addLineDecoration = (pos: number, decoration: Decoration) => {
      const line = doc.lineAt(pos);
      const key = `line-${line.number}`;
      if (!processedRanges.has(key)) {
        processedRanges.add(key);
        decorations.push({ from: line.from, to: line.from, decoration });
      }
    };

    syntaxTree(view.state).iterate({
      enter: (node) => {
        const { from, to, name } = node;

        // ---------------------------------------------------------------------
        // HEADINGS (ATXHeading1 through ATXHeading6)
        // ---------------------------------------------------------------------
        if (name.startsWith("ATXHeading")) {
          const level = parseInt(name.replace("ATXHeading", ""), 10);
          if (level >= 1 && level <= 6) {
            const line = doc.lineAt(from);
            const lineText = line.text;

            // Find the header mark (# symbols and space)
            const headerMarkMatch = lineText.match(/^(#{1,6})\s*/);
            if (headerMarkMatch) {
              const markEnd = line.from + headerMarkMatch[0].length;
              const contentStart = markEnd;
              const contentEnd = line.to;

              // Apply heading style to the content
              if (contentStart < contentEnd) {
                addDecoration(
                  contentStart,
                  contentEnd,
                  headingDecorations[level],
                );
              }

              // Hide or show the # marks based on cursor position
              if (!isCursorOnLine(view, cursor, from)) {
                // Hide the # marks and space
                addDecoration(line.from, markEnd, hiddenDecoration);
              } else {
                // Show marks with heading style (same font size as content) + formatting mark style
                addDecoration(line.from, markEnd, headingDecorations[level]);
                addDecoration(line.from, markEnd, formattingMarkDecoration);
              }
            }
          }
        }

        // ---------------------------------------------------------------------
        // STRONG EMPHASIS (**bold** or __bold__)
        // ---------------------------------------------------------------------
        if (name === "StrongEmphasis") {
          const text = doc.sliceString(from, to);
          const markerLen =
            text.startsWith("**") || text.startsWith("__") ? 2 : 2;

          const contentStart = from + markerLen;
          const contentEnd = to - markerLen;

          if (contentStart < contentEnd) {
            // Apply bold style to content
            addDecoration(contentStart, contentEnd, strongDecoration);

            // Hide or show markers based on cursor
            if (!isCursorInRange(cursor, from, to)) {
              addDecoration(from, contentStart, hiddenDecoration);
              addDecoration(contentEnd, to, hiddenDecoration);
            } else {
              addDecoration(from, contentStart, formattingMarkDecoration);
              addDecoration(contentEnd, to, formattingMarkDecoration);
            }
          }
        }

        // ---------------------------------------------------------------------
        // EMPHASIS (*italic* or _italic_)
        // ---------------------------------------------------------------------
        if (name === "Emphasis") {
          const text = doc.sliceString(from, to);
          // Check it's not actually strong emphasis
          if (!text.startsWith("**") && !text.startsWith("__")) {
            const markerLen = 1;
            const contentStart = from + markerLen;
            const contentEnd = to - markerLen;

            if (contentStart < contentEnd) {
              // Apply italic style to content
              addDecoration(contentStart, contentEnd, emphasisDecoration);

              // Hide or show markers based on cursor
              if (!isCursorInRange(cursor, from, to)) {
                addDecoration(from, contentStart, hiddenDecoration);
                addDecoration(contentEnd, to, hiddenDecoration);
              } else {
                addDecoration(from, contentStart, formattingMarkDecoration);
                addDecoration(contentEnd, to, formattingMarkDecoration);
              }
            }
          }
        }

        // ---------------------------------------------------------------------
        // INLINE CODE (`code`)
        // ---------------------------------------------------------------------
        if (name === "InlineCode") {
          const text = doc.sliceString(from, to);
          // Handle both single and double backticks
          const backtickMatch = text.match(/^(`+)/);
          if (backtickMatch) {
            const markerLen = backtickMatch[1].length;
            const contentStart = from + markerLen;
            const contentEnd = to - markerLen;

            if (contentStart < contentEnd) {
              // Apply code style to content
              addDecoration(contentStart, contentEnd, inlineCodeDecoration);

              // Hide or show backticks based on cursor
              if (!isCursorInRange(cursor, from, to)) {
                addDecoration(from, contentStart, hiddenDecoration);
                addDecoration(contentEnd, to, hiddenDecoration);
              } else {
                addDecoration(from, contentStart, formattingMarkDecoration);
                addDecoration(contentEnd, to, formattingMarkDecoration);
              }
            }
          }
        }

        // ---------------------------------------------------------------------
        // BLOCKQUOTE (> quote)
        // ---------------------------------------------------------------------
        if (name === "Blockquote") {
          const cursorLine = doc.lineAt(cursor).number;

          // Iterate through each line in the blockquote
          const startLine = doc.lineAt(from).number;
          const endLine = doc.lineAt(to).number;

          for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
            const line = doc.line(lineNum);
            const lineText = line.text;

            // Find the > mark at the start of the line
            const quoteMatch = lineText.match(/^(\s*>+\s*)/);
            if (quoteMatch) {
              const markEnd = line.from + quoteMatch[0].length;
              const isCurrentLine = lineNum === cursorLine;

              // Apply blockquote line decoration (with border) to all lines
              addLineDecoration(line.from, blockquoteLineDecoration);

              // Apply blockquote style to the content
              if (markEnd < line.to) {
                addDecoration(markEnd, line.to, blockquoteDecoration);
              }

              // Only show > on the current cursor line, hide on all other lines
              if (!isCurrentLine) {
                addDecoration(line.from, markEnd, hiddenDecoration);
              } else {
                addDecoration(line.from, markEnd, formattingMarkDecoration);
              }
            }
          }
        }

        // ---------------------------------------------------------------------
        // FENCED CODE BLOCKS (```code```)
        // ---------------------------------------------------------------------
        if (name === "FencedCode") {
          const cursorInCode = isCursorInRange(cursor, from, to);

          const startLine = doc.lineAt(from).number;
          const endLine = doc.lineAt(to).number;

          for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
            const line = doc.line(lineNum);
            const lineText = line.text;

            // Check if this is an opening or closing fence line
            const fenceMatch = lineText.match(/^(\s*)(```+|~~~+)(\w*)?(\s*)$/);

            if (fenceMatch) {
              // This is a fence line
              const [, leadingSpace, backticks] = fenceMatch;
              const backtickStart = line.from + (leadingSpace?.length || 0);
              const backtickEnd = backtickStart + backticks.length;

              if (!cursorInCode) {
                // Hide only the backticks, keep the language identifier
                addDecoration(backtickStart, backtickEnd, hiddenDecoration);
              } else {
                addDecoration(
                  backtickStart,
                  backtickEnd,
                  formattingMarkDecoration,
                );
              }

              // Apply line decoration for fence lines too
              addLineDecoration(line.from, codeBlockLineDecoration);
            } else {
              // This is a code content line - apply code block styling
              addLineDecoration(line.from, codeBlockLineDecoration);
            }
          }
        }

        // ---------------------------------------------------------------------
        // LISTS (BulletList / OrderedList)
        // ---------------------------------------------------------------------
        if (name === "ListMark") {
          const indent = getListIndentLevel(node.node);
          const line = doc.lineAt(from);

          // Find the full mark including trailing space
          const afterMark = doc.sliceString(to, Math.min(to + 1, doc.length));
          const hideEnd = afterMark === " " ? to + 1 : to;

          // Only show the original mark when cursor is directly on or adjacent to the dash
          // (not when cursor is on the space after the dash)
          // Cursor should be at: from (left of dash), from+1 (on dash for single char marks), or to (right of dash)
          const cursorNearMark = cursor >= from && cursor <= to;

          // Add line decoration for indentation and borders
          const lineKey = `list-line-${line.number}`;
          if (!processedRanges.has(lineKey)) {
            processedRanges.add(lineKey);
            decorations.push({
              from: line.from,
              to: line.from,
              decoration: Decoration.line({
                class: `cm-list-line cm-list-indent-${indent}`,
              }),
            });
          }

          if (!cursorNearMark) {
            // Replace the list mark with a bullet widget
            addDecoration(
              from,
              hideEnd,
              Decoration.replace({
                widget: new BulletWidget(),
              }),
            );
          } else {
            // Show the mark with formatting style
            addDecoration(from, to, formattingMarkDecoration);
          }
        }

        // ---------------------------------------------------------------------
        // LINKS [text](url)
        // ---------------------------------------------------------------------
        if (name === "Link") {
          const cursorInLink = isCursorInRange(cursor, from, to);

          // Parse the link structure
          let linkTextStart = -1;
          let linkTextEnd = -1;
          let linkUrl = "";

          // Find child nodes
          const linkNode = node.node;
          let child = linkNode.firstChild;
          while (child) {
            if (child.name === "LinkMark") {
              const markText = doc.sliceString(child.from, child.to);
              if (markText === "[") {
                linkTextStart = child.to;
              } else if (markText === "]") {
                linkTextEnd = child.from;
              }
            } else if (child.name === "URL") {
              linkUrl = doc.sliceString(child.from, child.to);
            }
            child = child.nextSibling;
          }

          if (linkTextStart >= 0 && linkTextEnd > linkTextStart) {
            // Apply link text styling with click handler
            addDecoration(
              linkTextStart,
              linkTextEnd,
              Decoration.mark({
                class: "cm-link-text",
                attributes: { "data-url": linkUrl },
              }),
            );

            if (!cursorInLink) {
              // Hide [ and ]( and url and )
              // Hide opening [
              addDecoration(from, linkTextStart, hiddenDecoration);
              // Hide ](url)
              if (linkTextEnd < to) {
                addDecoration(linkTextEnd, to, hiddenDecoration);
              }
              // Add link icon widget after the text
              decorations.push({
                from: linkTextEnd,
                to: linkTextEnd,
                decoration: Decoration.widget({
                  widget: new LinkIconWidget(linkUrl),
                  side: 1,
                }),
              });
            } else {
              // Show formatting marks
              addDecoration(from, linkTextStart, formattingMarkDecoration);
              if (linkTextEnd < to) {
                addDecoration(linkTextEnd, to, formattingMarkDecoration);
              }
            }
          }
        }

        // ---------------------------------------------------------------------
        // AUTOLINKS (bare URLs like https://example.com)
        // ---------------------------------------------------------------------
        if (name === "URL" && node.node.parent?.name !== "Link") {
          // This is a bare URL, not inside a [text](url) link
          const url = doc.sliceString(from, to);
          addDecoration(
            from,
            to,
            Decoration.mark({
              class: "cm-autolink",
              attributes: { "data-url": url },
            }),
          );
        }

        if (name === "Autolink") {
          // <https://example.com> style
          const text = doc.sliceString(from, to);
          if (text.startsWith("<") && text.endsWith(">")) {
            // Hide the < and > but style the content
            const contentStart = from + 1;
            const contentEnd = to - 1;

            if (contentStart < contentEnd) {
              const url = doc.sliceString(contentStart, contentEnd);
              addDecoration(
                contentStart,
                contentEnd,
                Decoration.mark({
                  class: "cm-autolink",
                  attributes: { "data-url": url },
                }),
              );

              if (!isCursorInRange(cursor, from, to)) {
                addDecoration(from, contentStart, hiddenDecoration);
                addDecoration(contentEnd, to, hiddenDecoration);
              } else {
                addDecoration(from, contentStart, formattingMarkDecoration);
                addDecoration(contentEnd, to, formattingMarkDecoration);
              }
            }
          }
        }

        // ---------------------------------------------------------------------
        // HORIZONTAL RULE (---, ***, ___)
        // ---------------------------------------------------------------------
        if (name === "HorizontalRule") {
          const cursorOnLine = isCursorOnLine(view, cursor, from);

          if (!cursorOnLine) {
            // Replace with horizontal line widget
            addDecoration(
              from,
              to,
              Decoration.replace({
                widget: new HorizontalRuleWidget(),
                block: true,
              }),
            );
          } else {
            // Show the --- with formatting style
            addDecoration(from, to, formattingMarkDecoration);
          }
        }
      },
    });

    // Sort decorations by position and startSide (required for RangeSetBuilder)
    decorations.sort((a, b) => {
      if (a.from !== b.from) return a.from - b.from;
      // For same position, sort by startSide (lower startSide comes first)
      const aStartSide = a.decoration.startSide ?? 0;
      const bStartSide = b.decoration.startSide ?? 0;
      if (aStartSide !== bStartSide) return aStartSide - bStartSide;
      return a.to - b.to;
    });

    // Build the decoration set
    for (const { from, to, decoration } of decorations) {
      if (decoration.spec?.widget && from === to) {
        // Widget decoration
        builder.add(from, to, decoration);
      } else if (from < to) {
        // Range decoration
        builder.add(from, to, decoration);
      } else if (from === to && decoration.spec?.class?.includes("line")) {
        // Line decoration
        builder.add(from, to, decoration);
      }
    }

    return builder.finish();
  }
}

export const obsidianMode = ViewPlugin.fromClass(ObsidianModePlugin, {
  decorations: (v) => v.decorations,
});
