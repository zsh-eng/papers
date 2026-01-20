import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { matchesShortcut } from "./shortcut-utils";
import type { Command } from "./types";

interface CommandRegistryContextType {
  register: (command: Command) => void;
  unregister: (id: string) => void;
  getVisibleCommands: () => Command[];
  execute: (id: string) => Promise<void>;
  findByShortcut: (e: KeyboardEvent) => Command | undefined;
}

const CommandRegistryContext = createContext<CommandRegistryContextType | null>(
  null,
);

export function CommandRegistryProvider({ children }: { children: ReactNode }) {
  const [commands, setCommands] = useState<Map<string, Command>>(new Map());

  const register = useCallback((cmd: Command) => {
    setCommands((prev) => new Map(prev).set(cmd.id, cmd));
  }, []);

  const unregister = useCallback((id: string) => {
    setCommands((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const getVisibleCommands = useCallback(() => {
    return Array.from(commands.values())
      .filter((cmd) => !cmd.when || cmd.when())
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [commands]);

  const execute = useCallback(
    async (id: string) => {
      const cmd = commands.get(id);
      if (cmd && (!cmd.when || cmd.when())) {
        await cmd.execute();
      }
    },
    [commands],
  );

  const findByShortcut = useCallback(
    (e: KeyboardEvent): Command | undefined => {
      return Array.from(commands.values()).find((cmd) => {
        if (!cmd.shortcut) return false;
        // Only match if command is currently available
        if (cmd.when && !cmd.when()) return false;
        return matchesShortcut(e, cmd.shortcut);
      });
    },
    [commands],
  );

  return (
    <CommandRegistryContext.Provider
      value={{
        register,
        unregister,
        getVisibleCommands,
        execute,
        findByShortcut,
      }}
    >
      {children}
    </CommandRegistryContext.Provider>
  );
}

export function useCommandRegistry() {
  const ctx = useContext(CommandRegistryContext);
  if (!ctx) {
    throw new Error(
      "useCommandRegistry must be used within CommandRegistryProvider",
    );
  }
  return ctx;
}
