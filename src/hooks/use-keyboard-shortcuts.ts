import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { queryClient } from "@/lib/query-client";

/**
 * Hook for handling global keyboard shortcuts for tab management.
 * Calls Rust commands directly - can be used in any webview.
 *
 * Shortcuts:
 * - Cmd/Ctrl + T: New tab
 * - Cmd/Ctrl + W: Close current tab
 * - Cmd/Ctrl + R: Refresh current tab data (invalidate queries)
 * - Cmd/Ctrl + Tab: Next tab
 * - Cmd/Ctrl + Shift + Tab: Previous tab
 * - Cmd + 1-9: Switch to tab by index
 */
export function useTabKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + T: New tab
      if (isMod && e.key === "t") {
        e.preventDefault();
        await invoke("create_tab", {
          tabType: "home",
          paperPath: null,
          title: "Library",
        });
        return;
      }

      // Cmd/Ctrl + W: Close active tab
      if (isMod && e.key === "w") {
        e.preventDefault();
        await invoke("close_active_tab");
        return;
      }

      // Cmd/Ctrl + R: Refresh current tab data
      if (isMod && e.key === "r") {
        e.preventDefault();
        queryClient.invalidateQueries();
        return;
      }

      // Cmd/Ctrl + Tab / Cmd/Ctrl + Shift + Tab: Cycle tabs
      if (isMod && e.key === "Tab") {
        e.preventDefault();
        await invoke(e.shiftKey ? "prev_tab" : "next_tab");
        return;
      }

      // Cmd + 1-9: Switch to specific tab (macOS style, using metaKey only)
      if (e.metaKey && !e.ctrlKey && !e.altKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) {
          e.preventDefault();
          await invoke("switch_tab_by_index", { index: num - 1 });
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
