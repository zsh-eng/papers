import { queryClient } from "@/lib/query-client";
import { invoke } from "@tauri-apps/api/core";
import type { Command, Modifier } from "./types";

/**
 * Factory function to create commands for the shell (tab bar).
 * These are a subset of global commands that make sense in the shell context.
 */
export function createShellCommands(options: {
  tabCount: number;
  toggleTheme: () => void;
}): Command[] {
  const { tabCount, toggleTheme } = options;

  const commands: Command[] = [
    // Tab Commands
    {
      id: "tab.new",
      title: "New Tab",
      shortcut: { key: "t", modifiers: ["cmd"] },
      execute: () =>
        invoke("create_tab", {
          tabType: "home",
          paperPath: null,
          title: "Library",
        }),
    },
    {
      id: "tab.close",
      title: "Close Tab",
      shortcut: { key: "w", modifiers: ["cmd"] },
      execute: () => invoke("close_active_tab"),
    },
    {
      id: "tab.next",
      title: "Next Tab",
      shortcut: { key: "Tab", modifiers: ["cmd"] },
      when: () => tabCount > 1,
      execute: () => invoke("next_tab"),
    },
    {
      id: "tab.previous",
      title: "Previous Tab",
      shortcut: { key: "Tab", modifiers: ["cmd", "shift"] },
      when: () => tabCount > 1,
      execute: () => invoke("prev_tab"),
    },
    {
      id: "tab.refresh",
      title: "Refresh",
      shortcut: { key: "r", modifiers: ["cmd"] },
      execute: () => queryClient.invalidateQueries(),
    },

    // Appearance Commands
    {
      id: "appearance.toggleDarkMode",
      title: "Toggle Dark Mode",
      shortcut: { key: "d", modifiers: ["cmd", "shift"] },
      execute: toggleTheme,
    },
  ];

  // Add tab 1-9 shortcuts (only visible when that tab exists and there's >1 tab)
  for (let i = 0; i < 9; i++) {
    commands.push({
      id: `tab.goTo${i + 1}`,
      title: `Go to Tab ${i + 1}`,
      shortcut: { key: String(i + 1), modifiers: ["cmd"] as Modifier[] },
      when: () => tabCount > 1 && tabCount > i,
      execute: () => invoke("switch_tab_by_index", { index: i }),
    });
  }

  return commands;
}
