import { useCommandRegistry } from "@/lib/commands/registry";
import { useEffect } from "react";

/**
 * Global keyboard shortcut handler.
 * Listens for all registered command shortcuts and executes them.
 */
export function useGlobalKeyboardHandler() {
  const registry = useCommandRegistry();

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Skip if user is typing in an input (except for command palette shortcut)
      const target = e.target as HTMLElement;
      const isInInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInInput) {
        // Allow command palette shortcut even in inputs
        const isCommandPalette =
          (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p";
        if (!isCommandPalette) return;
      }

      const command = registry.findByShortcut(e);
      if (command) {
        e.preventDefault();
        await registry.execute(command.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [registry]);
}

// Keep the old export name as an alias for backwards compatibility during migration
export const useTabKeyboardShortcuts = useGlobalKeyboardHandler;
