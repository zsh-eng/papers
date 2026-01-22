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
      const command = registry.findByShortcut(e);
      if (!command) return;

      // Check if user is in an input field
      const target = e.target as HTMLElement;
      const isInInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Skip if in input and command doesn't allow it
      if (isInInput && !command.allowInInput) return;

      e.preventDefault();
      await registry.execute(command.id);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [registry]);
}
