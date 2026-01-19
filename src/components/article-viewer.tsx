import {
  HIGHLIGHT_COLORS,
  isHtmlAnnotation,
  type Annotation,
  type AnnotationColor,
  type TextPosition,
} from "@/lib/annotations";
import { cn } from "@/lib/utils";
import {
  createHighlightFromSelection,
  getSelectionPosition,
} from "@zsh-eng/text-highlighter";
import type { SyncableHighlight } from "@zsh-eng/text-highlighter/react";
import { useHighlighter } from "@zsh-eng/text-highlighter/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ArticleViewerProps {
  /** Pre-rendered HTML content */
  html: string;
  /** Article title (from frontmatter) */
  title?: string;
  /** Article authors (from frontmatter) */
  authors?: string[];
  className?: string;
  /** Annotations to display */
  annotations?: Annotation[];
  /** Callback when a new annotation is created */
  onAnnotationCreate?: (position: TextPosition, color: AnnotationColor) => void;
  /** Callback when an annotation is deleted */
  onAnnotationDelete?: (id: string) => void;
}

interface ToolbarState {
  x: number;
  y: number;
  mode: "create" | "edit";
  annotationId?: string;
}

// Mapping of color names to CSS classes (used by toolbar)
const HIGHLIGHT_COLOR_CLASSES: Record<AnnotationColor, string> = {
  yellow: "bg-yellow-200/70 dark:bg-yellow-500/40",
  green: "bg-green-200/70 dark:bg-green-500/40",
  blue: "bg-blue-200/70 dark:bg-blue-500/40",
  magenta: "bg-pink-200/70 dark:bg-pink-500/40",
  invisible: "",
};

// Extend SyncableHighlight with color field
interface AnnotationHighlight extends SyncableHighlight {
  color: AnnotationColor;
}

/**
 * Separated content component to isolate re-renders.
 */
const ArticleContent = memo(
  ({
    html,
    contentRef,
    onMouseUp,
  }: {
    html: string;
    contentRef: React.RefObject<HTMLDivElement | null>;
    onMouseUp: () => void;
  }) => {
    return (
      <div
        ref={contentRef}
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: html }}
        onMouseUp={onMouseUp}
      />
    );
  },
);

/**
 * A pure HTML renderer for articles/papers with annotation support.
 * Expects pre-rendered HTML - does not do any markdown processing.
 */
export function ArticleViewer({
  html,
  title,
  authors,
  className,
  annotations = [],
  onAnnotationCreate,
  onAnnotationDelete,
}: ArticleViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const pendingSelectionRef = useRef<TextPosition | null>(null);

  // Transform annotations to SyncableHighlight format for the hook
  const syncableHighlights = useMemo<AnnotationHighlight[]>(
    () =>
      annotations
        .filter(isHtmlAnnotation)
        .filter((a) => a.color !== "invisible")
        .map((ann) => ({
          id: ann.id,
          startOffset: ann.position.startOffset,
          endOffset: ann.position.endOffset,
          selectedText: ann.position.selectedText,
          color: ann.color,
        })),
    [annotations],
  );

  // Use the declarative highlighter hook
  const { setActiveHighlight } = useHighlighter({
    containerRef: contentRef,
    highlights: syncableHighlights,
    contentReady: Boolean(html),
    className: "annotation-highlight",
    hoverClass: "annotation-highlight-hover",
    activeClass: "annotation-highlight-active",
    getAttributes: (h) => ({
      "data-color": h.color,
    }),
    onHighlightClick: (id, position) => {
      setToolbar({
        x: position.x,
        y: position.y - 8,
        mode: "edit",
        annotationId: id,
      });
    },
  });

  // Sync active state with toolbar
  useEffect(() => {
    setActiveHighlight(toolbar?.annotationId ?? null);
  }, [toolbar?.annotationId, setActiveHighlight]);

  // Handle text selection
  const handleMouseUp = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    // Check if selection is within our container
    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      return;
    }

    // Create highlight data from selection
    const highlightData = createHighlightFromSelection(selection, container);
    if (!highlightData) {
      return;
    }

    // Get position for toolbar
    const position = getSelectionPosition(selection);
    if (!position) {
      return;
    }

    // Store the selection data and show toolbar
    pendingSelectionRef.current = highlightData;
    setToolbar({
      x: position.x,
      y: position.y - 8,
      mode: "create",
    });
  }, []);

  // Handle color selection
  const handleColorSelect = useCallback(
    (color: AnnotationColor) => {
      if (toolbar?.mode === "create" && pendingSelectionRef.current) {
        onAnnotationCreate?.(pendingSelectionRef.current, color);
        pendingSelectionRef.current = null;
        window.getSelection()?.removeAllRanges();
      }
      setToolbar(null);
    },
    [toolbar, onAnnotationCreate],
  );

  // Handle annotation deletion
  const handleDelete = useCallback(() => {
    if (toolbar?.mode === "edit" && toolbar.annotationId) {
      onAnnotationDelete?.(toolbar.annotationId);
    }
    setToolbar(null);
  }, [toolbar, onAnnotationDelete]);

  // Close toolbar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-annotation-toolbar]")) {
        setToolbar(null);
        pendingSelectionRef.current = null;
      }
    };

    if (toolbar) {
      // Use setTimeout to avoid immediately closing when opening
      const timeout = setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
      }, 0);
      return () => {
        clearTimeout(timeout);
        document.removeEventListener("click", handleClickOutside);
      };
    }
  }, [toolbar]);

  return (
    <div className={cn(className)}>
      {/* Paper title hero section - positioned ~1/3 down */}
      <div className="pt-[33vh] pb-16 max-w-175 mx-auto">
        {title && <h1 className="paper-title">{title}</h1>}

        {/* Paper authors */}
        {authors && authors.length > 0 && (
          <div className="paper-authors">{authors.join(" · ")}</div>
        )}
      </div>

      {/* Paper body */}
      <ArticleContent
        html={html}
        contentRef={contentRef}
        onMouseUp={handleMouseUp}
      />

      {/* Annotation toolbar */}
      {toolbar && (
        <div
          data-annotation-toolbar
          className="fixed z-50 flex items-center gap-1 p-1.5 bg-popover border border-border rounded-lg shadow-lg"
          style={{
            left: toolbar.x,
            top: toolbar.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          {toolbar.mode === "create" ? (
            // Color selection buttons
            HIGHLIGHT_COLORS.map(({ name }) => (
              <button
                key={name}
                onClick={() => handleColorSelect(name)}
                className={cn(
                  "w-6 h-6 rounded-md border border-border/50 transition-transform hover:scale-110",
                  HIGHLIGHT_COLOR_CLASSES[name],
                )}
                title={`Highlight ${name}`}
              />
            ))
          ) : (
            // Edit mode - show delete button
            <button
              onClick={handleDelete}
              className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded"
              title="Remove highlight"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
