import { useCallback, useEffect, useRef, useState } from "react";

interface UseSearchOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  onClose?: () => void;
}

interface UseSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  matchCount: number;
  currentMatchIndex: number;
  nextMatch: () => void;
  previousMatch: () => void;
  close: () => void;
}

/**
 * Hook for in-page search using the CSS Custom Highlights API.
 * Finds all occurrences of query in the container and highlights them.
 */
export function useSearch({
  containerRef,
  onClose,
}: UseSearchOptions): UseSearchReturn {
  const [query, setQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  // Store ranges in ref (for DOM access in effects without triggering re-renders)
  const rangesRef = useRef<Range[]>([]);

  // Force a repaint on the container (needed for CSS Highlights API updates to render)
  const forceRepaint = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      // Toggle transform to force GPU layer repaint
      container.style.transform = "translateZ(0)";
      requestAnimationFrame(() => {
        container.style.transform = "";
      });
    }
  }, [containerRef]);

  // Clear all highlights synchronously
  const clearHighlights = useCallback(() => {
    if (CSS.highlights) {
      CSS.highlights.delete("search-results");
      CSS.highlights.delete("search-results-current");
    }
    rangesRef.current = [];
    forceRepaint();
  }, [forceRepaint]);

  // Collect all text nodes from the container
  const getTextNodes = useCallback((): Text[] => {
    const container = containerRef.current;
    if (!container) return [];

    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
    );

    let node = walker.nextNode();
    while (node) {
      textNodes.push(node as Text);
      node = walker.nextNode();
    }

    return textNodes;
  }, [containerRef]);

  // Compute ranges and update state - wrapped to batch state updates
  const updateSearch = useCallback(
    (newQuery: string) => {
      if (!CSS.highlights) return;

      const searchStr = newQuery.trim().toLowerCase();
      if (!searchStr) {
        clearHighlights();
        setMatchCount(0);
        setCurrentMatchIndex(-1);
        return;
      }

      const textNodes = getTextNodes();
      const foundRanges: Range[] = [];

      for (const textNode of textNodes) {
        const text = textNode.textContent?.toLowerCase() || "";
        let startPos = 0;

        while (startPos < text.length) {
          const index = text.indexOf(searchStr, startPos);
          if (index === -1) break;

          const range = new Range();
          range.setStart(textNode, index);
          range.setEnd(textNode, index + searchStr.length);
          foundRanges.push(range);

          startPos = index + searchStr.length;
        }
      }

      rangesRef.current = foundRanges;
      setMatchCount(foundRanges.length);
      setCurrentMatchIndex(foundRanges.length > 0 ? 0 : -1);
    },
    [getTextNodes, clearHighlights],
  );

  // Wrapped setQuery that also triggers search update
  const setQueryAndSearch = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      updateSearch(newQuery);
    },
    [updateSearch],
  );

  // Register CSS highlights when matchCount changes (side effect only)
  useEffect(() => {
    if (!CSS.highlights) return;

    CSS.highlights.delete("search-results");

    const ranges = rangesRef.current;
    if (ranges.length > 0) {
      const allHighlight = new Highlight(...ranges);
      CSS.highlights.set("search-results", allHighlight);
    }

    return () => {
      CSS.highlights?.delete("search-results");
      forceRepaint();
    };
  }, [matchCount, query, forceRepaint]);

  // Update the current match highlight and scroll to it
  useEffect(() => {
    if (!CSS.highlights) return;

    // Clear previous current highlight
    CSS.highlights.delete("search-results-current");

    const ranges = rangesRef.current;
    if (currentMatchIndex >= 0 && currentMatchIndex < ranges.length) {
      const currentRange = ranges[currentMatchIndex];

      // Create highlight for current match
      const currentHighlight = new Highlight(currentRange);
      CSS.highlights.set("search-results-current", currentHighlight);

      // Scroll to current match
      const rect = currentRange.getBoundingClientRect();
      const scrollContainer = containerRef.current?.closest(".overflow-auto");

      if (scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const isInView =
          rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;

        if (!isInView) {
          // Calculate the scroll position to center the match
          const scrollTop =
            scrollContainer.scrollTop +
            (rect.top - containerRect.top) -
            containerRect.height / 2;

          scrollContainer.scrollTo({
            top: scrollTop,
            behavior: "smooth",
          });
        }
      }
    } else {
      // No current match - force repaint to clear stale highlight
      forceRepaint();
    }

    return () => {
      CSS.highlights?.delete("search-results-current");
      // forceRepaint();
    };
  }, [currentMatchIndex, matchCount, query, containerRef, forceRepaint]);

  const nextMatch = useCallback(() => {
    if (matchCount === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matchCount);
  }, [matchCount]);

  const previousMatch = useCallback(() => {
    if (matchCount === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matchCount) % matchCount);
  }, [matchCount]);

  const close = useCallback(() => {
    clearHighlights();
    setQuery("");
    setMatchCount(0);
    setCurrentMatchIndex(-1);
    onClose?.();
  }, [onClose, clearHighlights]);

  return {
    query,
    setQuery: setQueryAndSearch,
    matchCount,
    currentMatchIndex,
    nextMatch,
    previousMatch,
    close,
  };
}
