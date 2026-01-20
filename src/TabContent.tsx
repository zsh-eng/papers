import { ActionCommandPalette } from "@/components/action-command-palette";
import { CommandPalette } from "@/components/command-palette";
import { MarkdownReader } from "@/components/markdown-reader";
import { PaperLibrary } from "@/components/paper-library";
import { PaperReader } from "@/components/paper-reader";
import { useCommands } from "@/hooks/use-commands";
import { useGlobalKeyboardHandler } from "@/hooks/use-keyboard-shortcuts";
import { useQuerySync } from "@/hooks/use-query-sync";
import { useTabState } from "@/hooks/use-tab-state";
import { useWorkspace } from "@/hooks/use-workspace";
import { createGlobalCommands } from "@/lib/commands/global-commands";

import type { MarkdownFile, Paper } from "@/lib/papers";
import { loadMarkdownFile, loadPaper } from "@/lib/papers";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDarkMode } from "./hooks/use-theme";

/**
 * Inner component that uses the command registry.
 * Must be wrapped in CommandRegistryProvider.
 */
export function TabContent() {
  const params = new URLSearchParams(window.location.search);
  const initialTabType = params.get("type") || "home";
  const paperPath = params.get("path");

  const { workspacePath, isLoading: isWorkspaceLoading } = useWorkspace();
  const { tabs } = useTabState();

  // Set up cross-webview query synchronization
  useQuerySync();

  // Subscribe to dark mode changes and get toggle function
  const { toggle: toggleTheme } = useDarkMode();

  // Quick Open (file search) palette state
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);

  // Action command palette state
  const [actionPaletteOpen, setActionPaletteOpen] = useState(false);

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

  // Handle back navigation from paper reader (SPA navigation)
  const handleBack = useCallback(async () => {
    setView("home");
    setCurrentPaper(null);
    setCurrentMarkdown(null);
    // Update tab title back to Library
    await invoke("update_current_tab_title", { title: "Library" });
  }, []);

  // Register global commands
  const globalCommands = useMemo(
    () =>
      createGlobalCommands({
        tabCount: tabs.length,
        view,
        toggleTheme,
        goToLibrary: handleBack,
        openQuickOpen: () => setQuickOpenOpen(true),
        openActionPalette: () => setActionPaletteOpen(true),
      }),
    [tabs.length, view, toggleTheme, handleBack],
  );

  useCommands(globalCommands, [globalCommands]);

  // Global keyboard handler (uses command registry)
  useGlobalKeyboardHandler();

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

  // Set up handler for pool webviews to receive tab params dynamically
  useEffect(() => {
    (window as unknown as { __setTabParams?: (type: string, encodedPath: string | null) => void }).__setTabParams = (
      type: string,
      encodedPath: string | null
    ) => {
      const path = encodedPath ? decodeURIComponent(encodedPath) : null;

      if (type === "paper" && path) {
        setIsPaperLoading(true);
        loadPaper(path)
          .then((loadedPaper) => {
            if (loadedPaper) {
              setCurrentPaper(loadedPaper);
              setView("paper");
              const title = loadedPaper.metadata.title || loadedPaper.id;
              invoke("update_current_tab_title", { title });
            } else {
              console.error("Paper not found at path:", path);
              setView("home");
              invoke("update_current_tab_title", { title: "Library" });
            }
          })
          .catch((err: unknown) => {
            console.error("Failed to load paper:", err);
            setView("home");
            invoke("update_current_tab_title", { title: "Library" });
          })
          .finally(() => {
            setIsPaperLoading(false);
          });
      } else if (type === "markdown" && path) {
        setIsMarkdownLoading(true);
        loadMarkdownFile(path)
          .then((loadedMarkdown) => {
            if (loadedMarkdown) {
              setCurrentMarkdown(loadedMarkdown);
              setView("markdown");
              const title = loadedMarkdown.metadata.title;
              invoke("update_current_tab_title", { title });
            } else {
              console.error("Markdown not found at path:", path);
              setView("home");
              invoke("update_current_tab_title", { title: "Library" });
            }
          })
          .catch((err: unknown) => {
            console.error("Failed to load markdown:", err);
            setView("home");
            invoke("update_current_tab_title", { title: "Library" });
          })
          .finally(() => {
            setIsMarkdownLoading(false);
          });
      }
      // For "home" type - already showing home, nothing to do
    };

    return () => {
      delete (window as unknown as { __setTabParams?: unknown }).__setTabParams;
    };
  }, []);

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

  // Common palettes rendered in all views
  const palettes = (
    <>
      <CommandPalette
        open={quickOpenOpen}
        onOpenChange={setQuickOpenOpen}
        onSelectPaper={handleSelectPaper}
        onSelectMarkdown={handleSelectMarkdown}
      />
      <ActionCommandPalette
        open={actionPaletteOpen}
        onOpenChange={setActionPaletteOpen}
      />
    </>
  );

  // Paper view
  if (view === "paper" && currentPaper) {
    return (
      <>
        <PaperReader paper={currentPaper} onBack={handleBack} />
        {palettes}
      </>
    );
  }

  // Markdown view
  if (view === "markdown" && currentMarkdown) {
    return (
      <>
        <MarkdownReader markdown={currentMarkdown} onBack={handleBack} />
        {palettes}
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
      {palettes}
    </>
  );
}
