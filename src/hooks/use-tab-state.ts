import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export interface TabInfo {
  id: string;
  tab_type: string; // "home" | "paper"
  paper_path: string | null;
  title: string;
}

export interface TabState {
  tabs: TabInfo[];
  active_tab_id: string;
}

/**
 * Hook for syncing tab state from Rust backend.
 * Read-only - listens to tab-state-changed events.
 * All tab actions should be invoked directly via Rust commands.
 */
export function useTabState() {
  const [state, setState] = useState<TabState>({ tabs: [], active_tab_id: "" });
  const [isLoading, setIsLoading] = useState(true);

  // Load initial state
  useEffect(() => {
    invoke<TabState>("get_tab_state")
      .then((initialState) => {
        setState(initialState);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to get initial tab state:", err);
        setIsLoading(false);
      });
  }, []);

  // Listen for state changes from Rust
  useEffect(() => {
    const unlisten = listen<TabState>("tab-state-changed", (event) => {
      setState(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return {
    tabs: state.tabs,
    activeTabId: state.active_tab_id,
    isLoading,
  };
}
