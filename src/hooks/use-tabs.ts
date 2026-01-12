import { useState, useCallback, useMemo } from "react";
import type { Paper } from "@/lib/papers";

export interface Tab {
  id: string;
  type: "home" | "paper";
  paper?: Paper;
  title: string;
}

function generateId(): string {
  return crypto.randomUUID();
}

function createHomeTab(): Tab {
  return {
    id: generateId(),
    type: "home",
    title: "Library",
  };
}

function createPaperTab(paper: Paper): Tab {
  return {
    id: generateId(),
    type: "paper",
    paper,
    title: paper.metadata.title || paper.filename,
  };
}

export function useTabs() {
  const [tabs, setTabs] = useState<Tab[]>(() => [createHomeTab()]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId]
  );

  const activeTabIndex = useMemo(
    () => tabs.findIndex((t) => t.id === activeTabId),
    [tabs, activeTabId]
  );

  // Create a new tab and make it active
  const createTab = useCallback((type: "home" | "paper", paper?: Paper) => {
    const newTab = type === "paper" && paper ? createPaperTab(paper) : createHomeTab();
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    return newTab.id;
  }, []);

  // Close a tab by ID
  // If closing the last tab, create a new home tab
  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const index = prev.findIndex((t) => t.id === id);
      if (index === -1) return prev;

      // If this is the last tab, create a new home tab
      if (prev.length === 1) {
        const newTab = createHomeTab();
        setActiveTabId(newTab.id);
        return [newTab];
      }

      const newTabs = prev.filter((t) => t.id !== id);

      // If we're closing the active tab, switch to an adjacent one
      setActiveTabId((currentActiveId) => {
        if (currentActiveId === id) {
          // Prefer the tab to the right, otherwise the one to the left
          const newIndex = Math.min(index, newTabs.length - 1);
          return newTabs[newIndex].id;
        }
        return currentActiveId;
      });

      return newTabs;
    });
  }, []);

  // Close the currently active tab
  const closeActiveTab = useCallback(() => {
    closeTab(activeTabId);
  }, [closeTab, activeTabId]);

  // Switch to a specific tab by ID
  const switchToTab = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  // Switch to a tab by index (1-based, for keyboard shortcuts)
  const switchToTabIndex = useCallback(
    (index: number) => {
      if (index >= 1 && index <= tabs.length) {
        setActiveTabId(tabs[index - 1].id);
      }
    },
    [tabs]
  );

  // Cycle to the next tab
  const nextTab = useCallback(() => {
    setTabs((currentTabs) => {
      const currentIndex = currentTabs.findIndex((t) => t.id === activeTabId);
      const nextIndex = (currentIndex + 1) % currentTabs.length;
      setActiveTabId(currentTabs[nextIndex].id);
      return currentTabs;
    });
  }, [activeTabId]);

  // Cycle to the previous tab
  const prevTab = useCallback(() => {
    setTabs((currentTabs) => {
      const currentIndex = currentTabs.findIndex((t) => t.id === activeTabId);
      const prevIndex = (currentIndex - 1 + currentTabs.length) % currentTabs.length;
      setActiveTabId(currentTabs[prevIndex].id);
      return currentTabs;
    });
  }, [activeTabId]);

  // Update the current tab to show a paper (navigate from home to paper)
  const navigateToPaper = useCallback(
    (paper: Paper) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                type: "paper" as const,
                paper,
                title: paper.metadata.title || paper.filename,
              }
            : t
        )
      );
    },
    [activeTabId]
  );

  // Update the current tab to show home (navigate back from paper)
  const navigateToHome = useCallback(() => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              type: "home" as const,
              paper: undefined,
              title: "Library",
            }
          : t
      )
    );
  }, [activeTabId]);

  return {
    tabs,
    activeTab,
    activeTabId,
    activeTabIndex,
    createTab,
    closeTab,
    closeActiveTab,
    switchToTab,
    switchToTabIndex,
    nextTab,
    prevTab,
    navigateToPaper,
    navigateToHome,
  };
}
