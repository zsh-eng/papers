import { queryClient } from "@/lib/query-client";
import { invoke } from "@tauri-apps/api/core";
import type { Command, Modifier } from "./types";

/**
 * Factory function to create global commands.
 * Takes callbacks for actions that need external state (theme toggle, navigation).
 */
export function createGlobalCommands(options: {
  tabCount: number;
  view: "home" | "paper" | "markdown";
  toggleTheme: () => void;
  goToLibrary: () => void;
  openQuickOpen: () => void;
  openActionPalette: () => void;
  openFileSearch: () => void;
}): Command[] {
  const {
    tabCount,
    view,
    toggleTheme,
    goToLibrary,
    openQuickOpen,
    openActionPalette,
    openFileSearch,
  } = options;

  const commands: Command[] = [
    // Tab Commands
    {
      id: "tab.new",
      title: "New Tab",
      shortcut: { key: "t", modifiers: ["cmd"] },
      allowInInput: true,
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
      allowInInput: true,
      execute: () => invoke("close_active_tab"),
    },
    {
      id: "tab.next",
      title: "Next Tab",
      shortcut: { key: "Tab", modifiers: ["cmd"] },
      allowInInput: true,
      when: () => tabCount > 1,
      execute: () => invoke("next_tab"),
    },
    {
      id: "tab.previous",
      title: "Previous Tab",
      shortcut: { key: "Tab", modifiers: ["cmd", "shift"] },
      allowInInput: true,
      when: () => tabCount > 1,
      execute: () => invoke("prev_tab"),
    },
    {
      id: "tab.refresh",
      title: "Refresh",
      shortcut: { key: "r", modifiers: ["cmd"] },
      allowInInput: true,
      execute: () => queryClient.invalidateQueries(),
    },

    // Appearance Commands
    {
      id: "appearance.toggleDarkMode",
      title: "Toggle Dark Mode",
      shortcut: { key: "d", modifiers: ["cmd", "shift"] },
      execute: toggleTheme,
    },

    // Navigation Commands
    {
      id: "navigation.goToLibrary",
      title: "Go to Library",
      shortcut: { key: "l", modifiers: ["cmd", "shift"] },
      when: () => view !== "home",
      execute: goToLibrary,
    },
    {
      id: "navigation.openQuickOpen",
      title: "Quick Open",
      shortcut: { key: "p", modifiers: ["cmd"] },
      allowInInput: true,
      execute: openQuickOpen,
    },
    {
      id: "navigation.openCommandPalette",
      title: "Command Palette",
      shortcut: { key: "p", modifiers: ["cmd", "shift"] },
      allowInInput: true,
      execute: openActionPalette,
    },
    {
      id: "navigation.openFileSearch",
      title: "Open File",
      shortcut: { key: "o", modifiers: ["cmd"] },
      allowInInput: true,
      execute: openFileSearch,
    },
  ];

  // Add tab 1-9 shortcuts (only visible when that tab exists and there's >1 tab)
  for (let i = 0; i < 9; i++) {
    commands.push({
      id: `tab.goTo${i + 1}`,
      title: `Go to Tab ${i + 1}`,
      shortcut: { key: String(i + 1), modifiers: ["cmd"] as Modifier[] },
      allowInInput: true,
      when: () => tabCount > 1 && tabCount > i,
      execute: () => invoke("switch_tab_by_index", { index: i }),
    });
  }

  return commands;
}
