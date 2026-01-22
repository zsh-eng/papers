import type { LucideIcon } from "lucide-react";

export type Modifier = "cmd" | "ctrl" | "shift" | "alt";

export interface Shortcut {
  key: string; // "T", "Tab", "1", etc.
  modifiers: Modifier[]; // ["cmd"], ["cmd", "shift"]
}

export interface Command {
  id: string; // "tab.new", "reader.toggleSidebar"
  title: string; // "New Tab", "Toggle Sidebar"
  shortcut?: Shortcut;
  icon?: LucideIcon;
  when?: () => boolean; // Return false to hide command
  execute: () => void | Promise<void>;
  /** If true, shortcut works even when focused in input/textarea/contenteditable */
  allowInInput?: boolean;
}
