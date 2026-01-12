import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { cn } from "@/lib/utils";

interface NotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

// Create a custom theme that matches the app's styling (Obsidian-like)
const customTheme = EditorView.theme({
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
});

export function NotesEditor({ value: initialValue, onChange, className, placeholder }: NotesEditorProps) {
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
        highlightActiveLine(),
        history(),
        bracketMatching(),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        customTheme,
        updateListener,
        EditorView.lineWrapping,
        placeholder ? EditorView.contentAttributes.of({ "data-placeholder": placeholder }) : [],
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
        className
      )}
    />
  );
}
