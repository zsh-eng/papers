import { invoke } from "@tauri-apps/api/core";
import { useMemo } from "react";
import { TabBar } from "@/components/tab-bar";
import { useCommands } from "@/hooks/use-commands";
import { useGlobalKeyboardHandler } from "@/hooks/use-keyboard-shortcuts";
import { useTabState } from "@/hooks/use-tab-state";
import { useDarkMode } from "@/hooks/use-theme";
import { useQuerySync } from "@/hooks/use-query-sync";
import { createShellCommands } from "@/lib/commands/shell-commands";

/**
 * Shell App - renders only in the main webview.
 * Displays the TabBar and manages tab state via Rust backend.
 * Tab content is rendered in separate child webviews.
 */
export function App() {
  const { tabs, activeTabId, isLoading } = useTabState();

  // Set up cross-webview query synchronization
  useQuerySync();

  // Subscribe to dark mode changes and get toggle function
  const { toggle: toggleTheme } = useDarkMode();

  // Register shell commands (tab operations, theme toggle)
  const shellCommands = useMemo(
    () =>
      createShellCommands({
        tabCount: tabs.length,
        toggleTheme,
      }),
    [tabs.length, toggleTheme],
  );

  useCommands(shellCommands, [shellCommands]);

  // Set up global keyboard shortcuts (uses command registry)
  useGlobalKeyboardHandler();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Always show the tab bar
  return (
    <TabBar
      tabs={tabs}
      activeTabId={activeTabId}
      onSwitchTab={(id) => invoke("switch_tab", { id })}
      onCloseTab={(id) => invoke("close_tab", { id })}
      onNewTab={() =>
        invoke("create_tab", {
          tabType: "home",
          paperPath: null,
          title: "Library",
        })
      }
    />
  );
}

export default App;
