import { useState, useEffect, useCallback } from "react";
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
 * Listens to tab-state-changed events and provides command wrappers.
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

  // Command wrappers
  const createTab = useCallback(
    async (tabType: string, paperPath?: string, title?: string) => {
      const tabTitle = title || (tabType === "home" ? "Library" : "Paper");
      return invoke<string>("create_tab", {
        tabType,
        paperPath: paperPath || null,
        title: tabTitle,
      });
    },
    [],
  );

  const closeTab = useCallback(async (id: string) => {
    return invoke("close_tab", { id });
  }, []);

  const switchTab = useCallback(async (id: string) => {
    return invoke("switch_tab", { id });
  }, []);

  const nextTab = useCallback(async () => {
    return invoke("next_tab");
  }, []);

  const prevTab = useCallback(async () => {
    return invoke("prev_tab");
  }, []);

  const switchTabByIndex = useCallback(async (index: number) => {
    return invoke("switch_tab_by_index", { index });
  }, []);

  const updateTabTitle = useCallback(async (id: string, title: string) => {
    return invoke("update_tab_title", { id, title });
  }, []);

  return {
    tabs: state.tabs,
    activeTabId: state.active_tab_id,
    isLoading,
    createTab,
    closeTab,
    switchTab,
    nextTab,
    prevTab,
    switchTabByIndex,
    updateTabTitle,
  };
}
