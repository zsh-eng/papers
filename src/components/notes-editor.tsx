import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, highlightActiveLine, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching } from "@codemirror/language";
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
    height: "100%",
    fontSize: "16px",
  },
  ".cm-scroller": {
    fontFamily: "'Outfit', system-ui, sans-serif",
    lineHeight: "1.75",
    overflow: "auto",
  },
  ".cm-content": {
    padding: "24px",
    caretColor: "var(--foreground)",
    maxWidth: "100%",
  },
  ".cm-line": {
    padding: "2px 0",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "var(--primary) !important",
    opacity: "0.3",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--primary)",
    opacity: "0.3",
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

  // Blockquote
  ".cm-blockquote": {
    borderLeft: "2px solid var(--border)",
    paddingLeft: "1rem",
    color: "var(--muted-foreground)",
    fontStyle: "italic",
  },

  // Lists
  ".cm-list-bullet": {
    color: "var(--muted-foreground)",
    fontWeight: "bold",
    display: "inline-block",
    width: "1.5em",
    textAlign: "center",
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
    color: "var(--foreground)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
  ".cm-link-icon": {
    opacity: "0.5",
    marginLeft: "4px",
    verticalAlign: "middle",
    display: "inline-flex",
    alignItems: "center",
  },
  ".cm-link-icon svg": {
    width: "14px",
    height: "14px",
  },
  ".cm-autolink": {
    color: "var(--chart-1)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
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
        bracketMatching(),
        markdown(),
        obsidianMode,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        obsidianTheme,
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
