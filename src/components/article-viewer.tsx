import { cn } from "@/lib/utils";
import {
  type AnnotationColor,
  type TextPosition,
  HIGHLIGHT_COLORS,
  isHtmlAnnotation,
  type Annotation,
} from "@/lib/annotations";
import {
  createHighlightFromSelection,
  getSelectionPosition,
  applyHighlight,
  removeHighlightById,
} from "@zsh-eng/text-highlighter";
import { useCallback, useEffect, useRef, useState } from "react";

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

// Mapping of color names to CSS classes
const HIGHLIGHT_COLOR_CLASSES: Record<AnnotationColor, string> = {
  yellow: "bg-yellow-200/70 dark:bg-yellow-500/40",
  green: "bg-green-200/70 dark:bg-green-500/40",
  blue: "bg-blue-200/70 dark:bg-blue-500/40",
  magenta: "bg-pink-200/70 dark:bg-pink-500/40",
  invisible: "",
};

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

  // Apply highlights when annotations change or content loads
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    // Filter to HTML annotations only
    const htmlAnnotations = annotations.filter(isHtmlAnnotation);

    // Remove all existing highlights first
    const existingMarks = container.querySelectorAll("[data-highlight-id]");
    existingMarks.forEach((mark) => {
      const id = mark.getAttribute("data-highlight-id");
      if (id) {
        removeHighlightById(container, id);
      }
    });

    // Apply each annotation
    htmlAnnotations.forEach((ann) => {
      const colorClass = HIGHLIGHT_COLOR_CLASSES[ann.color];
      if (ann.color === "invisible") return; // Don't render invisible highlights

      applyHighlight(container, ann.position, {
        tagName: "mark",
        className: `${colorClass} rounded-sm cursor-pointer transition-colors`,
        attributes: {
          "data-highlight-id": ann.id,
        },
      });
    });

    // Add click handlers for highlights
    const handleHighlightClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const mark = target.closest("[data-highlight-id]");
      if (mark) {
        const id = mark.getAttribute("data-highlight-id");
        if (id) {
          const rect = mark.getBoundingClientRect();
          setToolbar({
            x: rect.left + rect.width / 2,
            y: rect.top - 8,
            mode: "edit",
            annotationId: id,
          });
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    container.addEventListener("click", handleHighlightClick);
    return () => {
      container.removeEventListener("click", handleHighlightClick);
    };
  }, [annotations, html]);

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
    [toolbar, onAnnotationCreate]
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
      <div
        ref={contentRef}
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: html }}
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
                  HIGHLIGHT_COLOR_CLASSES[name]
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
