import { useEffect, useCallback } from "react";

interface KeyboardShortcutsOptions {
  onNewTab: () => unknown;
  onCloseTab: () => unknown;
  onNextTab: () => unknown;
  onPrevTab: () => unknown;
  onSwitchToTab: (index: number) => unknown;
}

/**
 * Hook for handling global keyboard shortcuts for tab management.
 *
 * Shortcuts:
 * - Cmd/Ctrl + T: New tab
 * - Cmd/Ctrl + W: Close current tab
 * - Cmd/Ctrl + Tab: Next tab
 * - Cmd/Ctrl + Shift + Tab: Previous tab
 * - Cmd + 1-9: Switch to tab by index
 */
export function useTabKeyboardShortcuts({
  onNewTab,
  onCloseTab,
  onNextTab,
  onPrevTab,
  onSwitchToTab,
}: KeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + T: New tab
      if (isMod && e.key === "t") {
        e.preventDefault();
        onNewTab();
        return;
      }

      // Cmd/Ctrl + W: Close tab
      if (isMod && e.key === "w") {
        e.preventDefault();
        onCloseTab();
        return;
      }

      // Cmd/Ctrl + Tab / Cmd/Ctrl + Shift + Tab: Cycle tabs
      if (isMod && e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          onPrevTab();
        } else {
          onNextTab();
        }
        return;
      }

      // Cmd + 1-9: Switch to specific tab (macOS style, using metaKey only)
      if (e.metaKey && !e.ctrlKey && !e.altKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) {
          e.preventDefault();
          onSwitchToTab(num);
          return;
        }
      }
    },
    [onNewTab, onCloseTab, onNextTab, onPrevTab, onSwitchToTab],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
