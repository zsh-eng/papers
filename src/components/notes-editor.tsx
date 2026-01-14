import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  highlightActiveLine,
  drawSelection,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentMore,
  indentLess,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { vim } from "@replit/codemirror-vim";
import { cn } from "@/lib/utils";
import { obsidianMode } from "@/lib/codemirror/obsidian-mode";

interface NotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

// Obsidian-like theme with clean styling and contextual syntax visibility
const obsidianTheme = EditorView.theme({
  // Base editor styles
  "&": {
    "--editor-padding": "24px",
    height: "100%",
    fontSize: "16px",
  },
  ".cm-scroller": {
    fontFamily: "'Outfit', system-ui, sans-serif",
    lineHeight: "1.75",
    overflow: "auto",
  },
  ".cm-content": {
    padding: "var(--editor-padding)",
    caretColor: "var(--foreground)",
    maxWidth: "100%",
  },
  ".cm-line": {
    padding: "1px 0",
  },
  // Constrain selection layer to not extend into content padding
  ".cm-selectionLayer": {
    left: "var(--editor-padding) !important",
    right: "var(--editor-padding) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--foreground)",
  },

  // Headings - bold, sized, NO underline
  ".cm-heading": {
    fontWeight: "700",
    color: "var(--foreground)",
  },
  ".cm-heading-1": {
    fontSize: "2em",
    lineHeight: "1.2",
  },
  ".cm-heading-2": {
    fontSize: "1.5em",
    lineHeight: "1.3",
  },
  ".cm-heading-3": {
    fontSize: "1.3em",
    lineHeight: "1.4",
  },
  ".cm-heading-4": {
    fontSize: "1.15em",
  },
  ".cm-heading-5": {
    fontSize: "1.1em",
  },
  ".cm-heading-6": {
    fontSize: "1.05em",
  },

  // Text formatting
  ".cm-strong": {
    fontWeight: "600",
  },
  ".cm-em": {
    fontStyle: "italic",
  },

  // Blockquote - just vertical border, no extra indent
  ".cm-blockquote-line": {
    borderLeft: "2px solid var(--border)",
    marginLeft: "0",
    paddingLeft: "0.75rem",
  },
  ".cm-blockquote": {
    color: "var(--muted-foreground)",
    fontStyle: "italic",
  },

  // Lists - base bullet style
  ".cm-list-bullet": {
    color: "var(--muted-foreground)",
    fontWeight: "bold",
    display: "inline",
    width: "1em",
    paddingRight: "0.25em",
    textAlign: "center",
  },

  // List line styling for proper indentation, hanging indent, and borders
  ".cm-list-line": {
    // Hanging indent: text-indent pulls first line left, padding-left pushes all content right
    // This makes wrapped lines align with the text after the bullet
    textIndent: "-1.5em",
    paddingLeft: "1.5em",
  },

  // Nested list indentation levels with vertical borders
  ".cm-list-indent-0": {
    marginLeft: "0",
  },
  ".cm-list-indent-1": {
    marginLeft: "1.5em",
    borderLeft: "1px solid var(--border)",
    paddingLeft: "calc(1.5em + 0.5em)", // hanging indent + border padding
  },
  ".cm-list-indent-2": {
    marginLeft: "3em",
    borderLeft: "1px solid var(--border)",
    paddingLeft: "calc(1.5em + 0.5em)",
  },
  ".cm-list-indent-3": {
    marginLeft: "4.5em",
    borderLeft: "1px solid var(--border)",
    paddingLeft: "calc(1.5em + 0.5em)",
  },
  ".cm-list-indent-4": {
    marginLeft: "6em",
    borderLeft: "1px solid var(--border)",
    paddingLeft: "calc(1.5em + 0.5em)",
  },
  ".cm-list-indent-5": {
    marginLeft: "7.5em",
    borderLeft: "1px solid var(--border)",
    paddingLeft: "calc(1.5em + 0.5em)",
  },

  // Inline code
  ".cm-inline-code": {
    fontFamily: "var(--font-mono)",
    backgroundColor: "var(--muted)",
    padding: "0.1em 0.3em",
    borderRadius: "3px",
    fontSize: "0.9em",
  },

  // Code blocks
  ".cm-code-block-line": {
    fontFamily: "var(--font-mono)",
    backgroundColor: "var(--muted)",
    fontSize: "0.9em",
    paddingLeft: "1rem !important",
    paddingRight: "1rem !important",
  },

  // Links
  ".cm-link-text": {
    color: "hsl(210, 100%, 50%)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
    cursor: "pointer",
  },
  ".cm-link-text:hover": {
    color: "hsl(210, 100%, 40%)",
  },
  ".cm-link-icon": {
    opacity: "0.5",
    marginLeft: "4px",
    verticalAlign: "middle",
    display: "inline-flex",
    alignItems: "center",
    cursor: "pointer",
  },
  ".cm-link-icon svg": {
    width: "14px",
    height: "14px",
  },
  ".cm-autolink": {
    color: "hsl(210, 100%, 50%)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
    cursor: "pointer",
  },
  ".cm-autolink:hover": {
    color: "hsl(210, 100%, 40%)",
  },

  // Horizontal rule
  ".cm-hr-line": {
    borderBottom: "1px solid var(--border)",
    margin: "1rem 0",
    height: "0",
  },

  // Formatting marks (when visible)
  ".cm-formatting-mark": {
    color: "var(--muted-foreground)",
    opacity: "0.6",
  },
});

// Click handler for links
const linkClickHandler = EditorView.domEventHandlers({
  click: (event) => {
    const target = event.target as HTMLElement;

    // Check if clicked on link text or autolink
    const linkElement = target.closest(".cm-link-text, .cm-autolink");
    if (linkElement) {
      const url = linkElement.getAttribute("data-url");
      if (url) {
        event.preventDefault();
        window.open(url, "_blank", "noopener,noreferrer");
        return true;
      }
    }

    return false;
  },
});

export function NotesEditor({
  value: initialValue,
  onChange,
  className,
  placeholder,
}: NotesEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref updated
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Initialize editor once on mount - fully uncontrolled after that
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const newValue = update.state.doc.toString();
        onChangeRef.current(newValue);
      }
    });

    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        vim(),
        drawSelection(),
        highlightActiveLine(),
        history(),
        markdown(),
        obsidianMode,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        keymap.of([
          { key: "Tab", run: indentMore },
          { key: "Shift-Tab", run: indentLess },
        ]),
        obsidianTheme,
        linkClickHandler,
        updateListener,
        EditorView.lineWrapping,
        placeholder
          ? EditorView.contentAttributes.of({ "data-placeholder": placeholder })
          : [],
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    return () => {
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - initialValue is intentionally not a dependency

  return (
    <div
      ref={containerRef}
      className={cn(
        "h-full overflow-hidden bg-background text-foreground",
        className,
      )}
    />
  );
}
