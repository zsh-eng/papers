import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";

/**
 * Hook that calls a callback when the window regains focus.
 * Useful for refreshing data when the user returns to the application.
 */
export function useVisibilityRefetch(onFocus: () => void) {
  const wasFocusedRef = useRef(true);
  const onFocusRef = useRef(onFocus);

  // Keep callback ref updated
  useEffect(() => {
    onFocusRef.current = onFocus;
  }, [onFocus]);

  useEffect(() => {
    const unlisten = getCurrentWindow().onFocusChanged(
      ({ payload: focused }) => {
        if (!focused) {
          wasFocusedRef.current = false;
        } else if (!wasFocusedRef.current) {
          // Window regained focus after losing it
          wasFocusedRef.current = true;
          onFocusRef.current();
        }
      },
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
