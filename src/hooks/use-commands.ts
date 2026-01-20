import { useCommandRegistry } from "@/lib/commands/registry";
import type { Command } from "@/lib/commands/types";
import { useEffect, type DependencyList } from "react";

/**
 * Register commands that are active while this component is mounted.
 * Commands are automatically unregistered on unmount.
 */
export function useCommands(commands: Command[], deps: DependencyList = []) {
  const registry = useCommandRegistry();

  useEffect(() => {
    commands.forEach((cmd) => registry.register(cmd));
    return () => {
      commands.forEach((cmd) => registry.unregister(cmd.id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
