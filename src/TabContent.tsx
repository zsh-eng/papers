import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PaperLibrary } from "@/components/paper-library";
import { PaperReader } from "@/components/paper-reader";
import { useWorkspace } from "@/hooks/use-workspace";
import { useTabKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import type { Paper } from "@/lib/papers";
import { loadPaper } from "@/lib/papers";

/**
 * TabContent is rendered inside each child webview.
 * It reads the tab type and paper path from URL params.
 */
export function TabContent() {
  const params = new URLSearchParams(window.location.search);
  const initialTabType = params.get("type") || "home";
  const paperPath = params.get("path");

  const { workspacePath, isLoading: isWorkspaceLoading } = useWorkspace();

  // Register tab keyboard shortcuts (shared hook, calls Rust directly)
  useTabKeyboardShortcuts();

  // SPA state for in-tab navigation
  const [view, setView] = useState<"home" | "paper">(initialTabType as "home" | "paper");
  const [currentPaper, setCurrentPaper] = useState<Paper | null>(null);
  const [isPaperLoading, setIsPaperLoading] = useState(initialTabType === "paper" && !!paperPath);

  // Load paper data when this is a paper tab (initial load from URL)
  useEffect(() => {
    if (initialTabType === "paper" && paperPath) {
      setIsPaperLoading(true);
      loadPaper(decodeURIComponent(paperPath))
        .then((loadedPaper) => {
          if (loadedPaper) {
            setCurrentPaper(loadedPaper);
            setView("paper");
            // Update tab title with paper name
            const title = loadedPaper.metadata.title || loadedPaper.filename;
            invoke("update_current_tab_title", { title });
          } else {
            // Paper not found, fall back to home view
            console.error("Paper not found at path:", paperPath);
            setView("home");
            invoke("update_current_tab_title", { title: "Library" });
          }
        })
        .catch((err: unknown) => {
          console.error("Failed to load paper:", err);
          // Fall back to home view
          setView("home");
          invoke("update_current_tab_title", { title: "Library" });
        })
        .finally(() => {
          setIsPaperLoading(false);
        });
    }
  }, [initialTabType, paperPath]);

  // Handle paper selection from library (SPA navigation, no Rust call)
  const handleSelectPaper = useCallback(
    async (selectedPaper: Paper, openInNewTab: boolean) => {
      if (openInNewTab) {
        // Create a new tab via Rust
        const title = selectedPaper.metadata.title || selectedPaper.filename;
        await invoke("create_tab", {
          tabType: "paper",
          paperPath: selectedPaper.path,
          title,
        });
      } else {
        // Navigate within this tab (SPA style)
        setCurrentPaper(selectedPaper);
        setView("paper");
        // Update tab title with paper name
        const title = selectedPaper.metadata.title || selectedPaper.filename;
        await invoke("update_current_tab_title", { title });
      }
    },
    []
  );

  // Handle back navigation from paper reader (SPA navigation)
  const handleBack = useCallback(async () => {
    setView("home");
    setCurrentPaper(null);
    // Update tab title back to Library
    await invoke("update_current_tab_title", { title: "Library" });
  }, []);

  // Loading states or workspace not ready
  if (isWorkspaceLoading || isPaperLoading || !workspacePath) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Paper view
  if (view === "paper" && currentPaper) {
    return <PaperReader paper={currentPaper} onBack={handleBack} />;
  }

  // Home/Library view
  return (
    <PaperLibrary
      workspacePath={workspacePath}
      onSelectPaper={handleSelectPaper}
    />
  );
}
