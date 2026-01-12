import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { PaperLibrary } from "@/components/paper-library";
import { PaperReader } from "@/components/paper-reader";
import { Onboarding } from "@/components/onboarding";
import { useWorkspace } from "@/hooks/use-workspace";
import type { Paper } from "@/lib/papers";
import { loadPaper } from "@/lib/papers";

/**
 * Hook to register tab keyboard shortcuts in child webviews.
 * These call Rust commands directly since child webviews don't have tab state.
 */
function useTabShortcuts() {
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + T: New tab
      if (isMod && e.key === "t") {
        e.preventDefault();
        await invoke("create_tab", { tabType: "home", paperPath: null, title: "Library" });
        return;
      }

      // Cmd/Ctrl + W: Close current tab
      if (isMod && e.key === "w") {
        e.preventDefault();
        // Get current webview's label (which is the tab ID)
        const webview = getCurrentWebviewWindow();
        await invoke("close_tab", { id: webview.label });
        return;
      }

      // Cmd/Ctrl + Tab / Cmd/Ctrl + Shift + Tab: Cycle tabs
      if (isMod && e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          await invoke("prev_tab");
        } else {
          await invoke("next_tab");
        }
        return;
      }

      // Cmd + 1-9: Switch to specific tab
      if (e.metaKey && !e.ctrlKey && !e.altKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) {
          e.preventDefault();
          await invoke("switch_tab_by_index", { index: num - 1 });
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

/**
 * TabContent is rendered inside each child webview.
 * It reads the tab type and paper path from URL params.
 */
export function TabContent() {
  const params = new URLSearchParams(window.location.search);
  const initialTabType = params.get("type") || "home";
  const paperPath = params.get("path");

  const { workspacePath, isLoading: isWorkspaceLoading, setWorkspace, clearWorkspace } =
    useWorkspace();

  // Register tab keyboard shortcuts
  useTabShortcuts();

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
          } else {
            // Paper not found, fall back to home view
            console.error("Paper not found at path:", paperPath);
            setView("home");
          }
        })
        .catch((err: unknown) => {
          console.error("Failed to load paper:", err);
          // Fall back to home view
          setView("home");
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
      }
    },
    []
  );

  // Handle back navigation from paper reader (SPA navigation)
  const handleBack = useCallback(() => {
    setView("home");
    setCurrentPaper(null);
  }, []);

  // Loading states
  if (isWorkspaceLoading || isPaperLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // No workspace selected - show onboarding
  if (!workspacePath) {
    return (
      <>
        {/* Titlebar drag region for window dragging */}
        <div className="titlebar-drag-region" />
        <Onboarding onComplete={setWorkspace} />
      </>
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
      onChangeWorkspace={clearWorkspace}
      onSelectPaper={handleSelectPaper}
    />
  );
}
