import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useRef } from "react";

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  matchCount: number;
  currentMatchIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  className?: string;
}

/**
 * Chrome-style floating search bar for in-page search.
 * Positioned at top-right of the viewport.
 */
export function SearchBar({
  query,
  onQueryChange,
  matchCount,
  currentMatchIndex,
  onNext,
  onPrevious,
  onClose,
  className,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when mounted
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    } else if (e.key === "Enter") {
      e.stopPropagation();
      if (e.shiftKey) {
        onPrevious();
      } else {
        onNext();
      }
    }
  };

  // Display match info
  const matchInfo =
    matchCount > 0
      ? `${currentMatchIndex + 1} of ${matchCount}`
      : query.trim()
        ? "0 of 0"
        : "";

  return (
    <div
      className={cn(
        "fixed top-16 right-6 z-50",
        "flex items-center gap-1 px-3 py-2",
        "bg-background/80 backdrop-blur-md",
        "border border-border rounded-lg shadow-lg",
        className,
      )}
    >
      {/* Search input */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in page..."
        className={cn(
          "w-48 px-2 py-1 text-sm",
          "bg-transparent border-none outline-none",
          "placeholder:text-muted-foreground",
        )}
      />

      {/* Match counter */}
      {matchInfo && (
        <span className="text-xs text-muted-foreground whitespace-nowrap min-w-12 text-center">
          {matchInfo}
        </span>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center gap-0.5 ml-1">
        <button
          onClick={onPrevious}
          disabled={matchCount === 0}
          className={cn(
            "p-1 rounded hover:bg-muted",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "transition-colors",
          )}
          aria-label="Previous match"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={onNext}
          disabled={matchCount === 0}
          className={cn(
            "p-1 rounded hover:bg-muted",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "transition-colors",
          )}
          aria-label="Next match"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className={cn("p-1 rounded hover:bg-muted ml-1", "transition-colors")}
        aria-label="Close search"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
