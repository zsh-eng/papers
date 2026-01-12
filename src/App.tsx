import { invoke } from "@tauri-apps/api/core";
import { TabBar } from "@/components/tab-bar";
import { useTabKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useTabState } from "@/hooks/use-tab-state";

/**
 * Shell App - renders only in the main webview.
 * Displays the TabBar and manages tab state via Rust backend.
 * Tab content is rendered in separate child webviews.
 */
export function App() {
  const { tabs, activeTabId, isLoading } = useTabState();

  // Set up global keyboard shortcuts for tabs (calls Rust directly)
  useTabKeyboardShortcuts();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show tab bar only when there are 2+ tabs
  const showTabBar = tabs.length >= 2;

  return (
    <>
      {showTabBar ? (
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
      ) : (
        /* Titlebar drag region when no tabs shown */
        <div className="titlebar-drag-region" />
      )}
    </>
  );
}

export default App;
