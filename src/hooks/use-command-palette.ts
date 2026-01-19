import { useCallback, useEffect, useState } from "react";

/**
 * Hook for managing command palette state and keyboard shortcut.
 *
 * Shortcuts:
 * - Cmd/Ctrl + P: Open command palette
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + P: Open command palette
      if (isMod && e.key === "p") {
        e.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const onOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
  }, []);

  return {
    open,
    onOpenChange,
  };
}
