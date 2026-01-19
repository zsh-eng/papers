import { HIGHLIGHT_COLORS, type AnnotationColor } from "@/lib/annotations";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface HighlightToolbarProps {
  /** Toolbar position (centered on this point) */
  position: { x: number; y: number };
  /** Callback when a color is selected */
  onColorSelect: (color: AnnotationColor) => void;
  /** Callback to close the toolbar */
  onClose: () => void;
  /** Current highlight color (edit mode) - if set, clicking same color deletes */
  currentColor?: AnnotationColor | null;
}

const TOOLBAR_WIDTH = 180;
const TOOLBAR_PADDING = 8;

/**
 * A floating toolbar for creating/editing highlights.
 *
 * Behavior:
 * - Create mode (no currentColor): Click a color to create highlight
 * - Edit mode (has currentColor): Click different color to change,
 *   click same color to delete
 */
export function HighlightToolbar({
  position,
  onColorSelect,
  onClose,
  currentColor,
}: HighlightToolbarProps) {
  // Calculate clamped position to keep toolbar in viewport
  const clampedPosition = (() => {
    let x = position.x - TOOLBAR_WIDTH / 2;
    let y = position.y - 56; // height + padding

    if (typeof window !== "undefined") {
      const { innerWidth } = window;

      // Horizontal clamping
      x = Math.max(
        TOOLBAR_PADDING,
        Math.min(x, innerWidth - TOOLBAR_WIDTH - TOOLBAR_PADDING),
      );

      // Show below if not enough space above
      if (y < TOOLBAR_PADDING) {
        y = position.y + TOOLBAR_PADDING;
      }
    }

    return { x, y };
  })();

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest("[data-highlight-toolbar]") &&
        !target.closest(".annotation-highlight")
      ) {
        onClose();
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      data-highlight-toolbar
      className={cn(
        "fixed z-50",
        "flex items-center justify-center gap-3",
        "px-2 py-2",
        "bg-popover/95 backdrop-blur-sm",
        "border border-border rounded-full",
        "shadow-lg shadow-black/10",
        "animate-in fade-in-0 zoom-in-95 duration-150",
      )}
      style={{
        left: clampedPosition.x,
        top: clampedPosition.y,
        width: TOOLBAR_WIDTH,
      }}
    >
      {HIGHLIGHT_COLORS.map(({ name }) => {
        const isCurrentColor = currentColor === name;

        return (
          <button
            key={name}
            onClick={() => onColorSelect(name)}
            className={cn(
              // Base circle styling
              "w-7 h-7 rounded-full",
              "transition-all duration-150 ease-out",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              // Hover effect
              "hover:scale-110",
              // Current color indicator (ring around it)
              isCurrentColor &&
                "ring-2 ring-foreground ring-offset-2 ring-offset-popover",
              // Subtle inner shadow for depth
              "shadow-inner shadow-black/10",
            )}
            style={{
              backgroundColor: `var(--highlight-${name})`,
            }}
            aria-label={
              isCurrentColor
                ? `Remove ${name} highlight`
                : currentColor
                  ? `Change to ${name}`
                  : `Highlight ${name}`
            }
            title={
              isCurrentColor
                ? "Click to remove highlight"
                : currentColor
                  ? `Change to ${name}`
                  : `Highlight ${name}`
            }
          />
        );
      })}
    </div>
  );
}
