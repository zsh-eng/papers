import { CommandPalette } from "@/components/command-palette";
import { MarkdownReader } from "@/components/markdown-reader";
import { PaperLibrary } from "@/components/paper-library";
import { PaperReader } from "@/components/paper-reader";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { useTabKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useQuerySync } from "@/hooks/use-query-sync";
import { useWorkspace } from "@/hooks/use-workspace";
import type { MarkdownFile, Paper } from "@/lib/papers";
import { loadPaper, loadMarkdownFile } from "@/lib/papers";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

/**
 * TabContent is rendered inside each child webview.
 * It reads the tab type and paper path from URL params.
 */
export function TabContent() {
  const params = new URLSearchParams(window.location.search);
  const initialTabType = params.get("type") || "home";
  const paperPath = params.get("path");

  const { workspacePath, isLoading: isWorkspaceLoading } = useWorkspace();

  // Set up cross-webview query synchronization
  useQuerySync();

  // Register tab keyboard shortcuts (shared hook, calls Rust directly)
  useTabKeyboardShortcuts();

  // Command palette state (Cmd+P)
  const { open: commandPaletteOpen, onOpenChange: setCommandPaletteOpen } =
    useCommandPalette();

  // SPA state for in-tab navigation
  const [view, setView] = useState<"home" | "paper" | "markdown">(
    initialTabType as "home" | "paper" | "markdown",
  );
  const [currentPaper, setCurrentPaper] = useState<Paper | null>(null);
  const [currentMarkdown, setCurrentMarkdown] = useState<MarkdownFile | null>(
    null,
  );
  const [isPaperLoading, setIsPaperLoading] = useState(
    initialTabType === "paper" && !!paperPath,
  );
  const [isMarkdownLoading, setIsMarkdownLoading] = useState(
    initialTabType === "markdown" && !!paperPath,
  );

  // Load paper data when this is a paper tab (initial load from URL)
  useEffect(() => {
    if (initialTabType === "paper" && paperPath) {
      // isPaperLoading is already initialized to true when conditions match
      loadPaper(decodeURIComponent(paperPath))
        .then((loadedPaper) => {
          if (loadedPaper) {
            setCurrentPaper(loadedPaper);
            setView("paper");
            // Update tab title with paper name
            const title = loadedPaper.metadata.title || loadedPaper.id;
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

  // Load markdown data when this is a markdown tab (initial load from URL)
  useEffect(() => {
    if (initialTabType === "markdown" && paperPath) {
      // isMarkdownLoading is already initialized to true when conditions match
      loadMarkdownFile(decodeURIComponent(paperPath))
        .then((loadedMarkdown) => {
          if (loadedMarkdown) {
            setCurrentMarkdown(loadedMarkdown);
            setView("markdown");
            // Update tab title with markdown name
            const title = loadedMarkdown.metadata.title;
            invoke("update_current_tab_title", { title });
          } else {
            // Markdown not found, fall back to home view
            console.error("Markdown not found at path:", paperPath);
            setView("home");
            invoke("update_current_tab_title", { title: "Library" });
          }
        })
        .catch((err: unknown) => {
          console.error("Failed to load markdown:", err);
          // Fall back to home view
          setView("home");
          invoke("update_current_tab_title", { title: "Library" });
        })
        .finally(() => {
          setIsMarkdownLoading(false);
        });
    }
  }, [initialTabType, paperPath]);

  // Handle paper selection from library (SPA navigation, no Rust call)
  const handleSelectPaper = useCallback(
    async (selectedPaper: Paper, openInNewTab: boolean) => {
      if (openInNewTab) {
        // Create a new tab via Rust
        const title = selectedPaper.metadata.title || selectedPaper.id;
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
        const title = selectedPaper.metadata.title || selectedPaper.id;
        await invoke("update_current_tab_title", { title });
      }
    },
    [],
  );

  // Handle markdown selection from library (SPA navigation)
  const handleSelectMarkdown = useCallback(
    async (selectedMarkdown: MarkdownFile, openInNewTab: boolean) => {
      if (openInNewTab) {
        // Create a new tab via Rust
        const title = selectedMarkdown.metadata.title;
        await invoke("create_tab", {
          tabType: "markdown",
          paperPath: selectedMarkdown.path,
          title,
        });
      } else {
        // Navigate within this tab (SPA style)
        setCurrentMarkdown(selectedMarkdown);
        setView("markdown");
        // Update tab title with markdown name
        const title = selectedMarkdown.metadata.title;
        await invoke("update_current_tab_title", { title });
      }
    },
    [],
  );

  // Handle back navigation from paper reader (SPA navigation)
  const handleBack = useCallback(async () => {
    setView("home");
    setCurrentPaper(null);
    setCurrentMarkdown(null);
    // Update tab title back to Library
    await invoke("update_current_tab_title", { title: "Library" });
  }, []);

  // Loading states or workspace not ready
  if (
    isWorkspaceLoading ||
    isPaperLoading ||
    isMarkdownLoading ||
    !workspacePath
  ) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Paper view
  if (view === "paper" && currentPaper) {
    return (
      <>
        <PaperReader paper={currentPaper} onBack={handleBack} />
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          onSelectPaper={handleSelectPaper}
          onSelectMarkdown={handleSelectMarkdown}
        />
      </>
    );
  }

  // Markdown view
  if (view === "markdown" && currentMarkdown) {
    return (
      <>
        <MarkdownReader markdown={currentMarkdown} onBack={handleBack} />
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          onSelectPaper={handleSelectPaper}
          onSelectMarkdown={handleSelectMarkdown}
        />
      </>
    );
  }

  // Home/Library view
  return (
    <>
      <PaperLibrary
        workspacePath={workspacePath}
        onSelectPaper={handleSelectPaper}
        onSelectMarkdown={handleSelectMarkdown}
      />
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onSelectPaper={handleSelectPaper}
        onSelectMarkdown={handleSelectMarkdown}
      />
    </>
  );
}
