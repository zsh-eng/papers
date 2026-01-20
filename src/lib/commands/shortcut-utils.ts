import type { Modifier, Shortcut } from "./types";

const MODIFIER_SYMBOLS: Record<Modifier, string> = {
  cmd: "⌘",
  ctrl: "⌃",
  shift: "⇧",
  alt: "⌥",
};

const KEY_SYMBOLS: Record<string, string> = {
  Tab: "⇥",
  Enter: "↩",
  Escape: "⎋",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Backspace: "⌫",
  " ": "Space",
};

/** Check if a keyboard event matches a shortcut definition */
export function matchesShortcut(e: KeyboardEvent, shortcut: Shortcut): boolean {
  const hasCmd =
    shortcut.modifiers.includes("cmd") || shortcut.modifiers.includes("ctrl");
  const hasShift = shortcut.modifiers.includes("shift");
  const hasAlt = shortcut.modifiers.includes("alt");

  if (hasCmd !== (e.metaKey || e.ctrlKey)) return false;
  if (hasShift !== e.shiftKey) return false;
  if (hasAlt !== e.altKey) return false;

  // Normalize key comparison
  const targetKey = shortcut.key.toLowerCase();
  const eventKey = e.key.toLowerCase();

  return targetKey === eventKey;
}

/** Get symbol for a modifier key */
export function getModifierSymbol(mod: Modifier): string {
  return MODIFIER_SYMBOLS[mod] ?? mod;
}

/** Get display symbol for a key */
export function getKeySymbol(key: string): string {
  return KEY_SYMBOLS[key] ?? key.toUpperCase();
}

/** Parse modifiers from a KeyboardEvent */
export function getEventModifiers(e: KeyboardEvent): Modifier[] {
  const mods: Modifier[] = [];
  if (e.metaKey || e.ctrlKey) mods.push("cmd");
  if (e.shiftKey) mods.push("shift");
  if (e.altKey) mods.push("alt");
  return mods;
}
