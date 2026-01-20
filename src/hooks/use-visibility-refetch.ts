import { useEffect, useRef } from "react";

/**
 * Hook that calls a callback when the document becomes visible after being hidden.
 * Useful for refreshing data when the user returns to the tab/window.
 */
export function useVisibilityRefetch(onVisible: () => void) {
  const wasHiddenRef = useRef(false);
  const onVisibleRef = useRef(onVisible);

  // Keep callback ref updated
  useEffect(() => {
    onVisibleRef.current = onVisible;
  }, [onVisible]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        wasHiddenRef.current = true;
      } else if (wasHiddenRef.current) {
        // Document became visible after being hidden
        wasHiddenRef.current = false;
        onVisibleRef.current();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
