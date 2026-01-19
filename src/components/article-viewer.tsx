import {
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
import { HighlightToolbar } from "./highlight-toolbar";

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
  /** Callback when an annotation is updated */
  onAnnotationUpdate?: (
    id: string,
    updates: { color?: AnnotationColor },
  ) => void;
}

interface ToolbarState {
  x: number;
  y: number;
  mode: "create" | "edit";
  annotationId?: string;
}

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
  onAnnotationUpdate,
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
    onHighlightClick: (id) => {
      // Find the highlight element to position toolbar above it
      const highlightEl = contentRef.current?.querySelector(
        `[data-highlight-id="${id}"]`,
      );
      if (highlightEl) {
        const rect = highlightEl.getBoundingClientRect();
        setToolbar({
          x: rect.left + rect.width / 2,
          y: rect.top,
          mode: "edit",
          annotationId: id,
        });
      }
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

  // Get current annotation color for edit mode
  const currentAnnotationColor = useMemo(() => {
    if (toolbar?.mode !== "edit" || !toolbar.annotationId) return null;
    const annotation = annotations.find((a) => a.id === toolbar.annotationId);
    return annotation?.color ?? null;
  }, [toolbar, annotations]);

  // Handle color selection (create or edit)
  const handleColorSelect = useCallback(
    (color: AnnotationColor) => {
      if (toolbar?.mode === "create" && pendingSelectionRef.current) {
        // Create new annotation
        onAnnotationCreate?.(pendingSelectionRef.current, color);
        pendingSelectionRef.current = null;
        window.getSelection()?.removeAllRanges();
      } else if (toolbar?.mode === "edit" && toolbar.annotationId) {
        // Edit mode: same color = delete, different color = change
        if (color === currentAnnotationColor) {
          onAnnotationDelete?.(toolbar.annotationId);
        } else {
          onAnnotationUpdate?.(toolbar.annotationId, { color });
        }
      }
      setToolbar(null);
    },
    [
      toolbar,
      currentAnnotationColor,
      onAnnotationCreate,
      onAnnotationDelete,
      onAnnotationUpdate,
    ],
  );

  // Handle toolbar close
  const handleToolbarClose = useCallback(() => {
    setToolbar(null);
    pendingSelectionRef.current = null;
  }, []);

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
        <HighlightToolbar
          position={{ x: toolbar.x, y: toolbar.y }}
          onColorSelect={handleColorSelect}
          onClose={handleToolbarClose}
          currentColor={currentAnnotationColor}
        />
      )}
    </div>
  );
}
