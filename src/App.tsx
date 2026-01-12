import { Onboarding } from "@/components/onboarding";
import { PaperLibrary } from "@/components/paper-library";
import { PaperReader } from "@/components/paper-reader";
import { TabBar } from "@/components/tab-bar";
import { useTabKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import type { Tab } from "@/hooks/use-tabs";
import { useTabs } from "@/hooks/use-tabs";
import { useWorkspace } from "@/hooks/use-workspace";
import type { Paper } from "@/lib/papers";
import { cn } from "@/lib/utils";
import { memo, useCallback, useEffect } from "react";

function LoadingScreen() {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

// Memoized tab pane to prevent re-renders when other tabs change
const TabPane = memo(function TabPane({
  tab,
  isActive,
  workspacePath,
  onBack,
  onChangeWorkspace,
  onSelectPaper,
}: {
  tab: Tab;
  isActive: boolean;
  workspacePath: string;
  onBack: () => void;
  onChangeWorkspace: () => void;
  onSelectPaper: (paper: Paper, openInNewTab: boolean) => void;
}) {
  useEffect(() => {
    console.log(`TabPane ${tab.id} mounted/updated, isActive: ${isActive}`);
  });

  return (
    <div
      className={cn(
        "fixed inset-0 top-[var(--titlebar-height)] overflow-y-auto",
        isActive
          ? "z-10"
          : "invisible z-0 pointer-events-none [content-visibility:hidden] [contain-intrinsic-size:auto_100vh]",
      )}
    >
      {tab.type === "paper" && tab.paper ? (
        <PaperReader paper={tab.paper} onBack={onBack} />
      ) : (
        <PaperLibrary
          workspacePath={workspacePath}
          onChangeWorkspace={onChangeWorkspace}
          onSelectPaper={onSelectPaper}
        />
      )}
    </div>
  );
});

export function App() {
  const { workspacePath, isLoading, setWorkspace, clearWorkspace } =
    useWorkspace();
  const {
    tabs,
    activeTabId,
    createTab,
    closeTab,
    closeActiveTab,
    switchToTab,
    switchToTabIndex,
    nextTab,
    prevTab,
    navigateToPaper,
    navigateToHome,
  } = useTabs();

  // Set up global keyboard shortcuts for tabs
  useTabKeyboardShortcuts({
    onNewTab: () => createTab("home"),
    onCloseTab: closeActiveTab,
    onNextTab: nextTab,
    onPrevTab: prevTab,
    onSwitchToTab: switchToTabIndex,
  });

  // Handle paper selection from library
  // If metaKey (Cmd) is held, open in new tab; otherwise navigate current tab
  const handleSelectPaper = useCallback(
    (paper: Paper, openInNewTab: boolean) => {
      if (openInNewTab) {
        createTab("paper", paper);
      } else {
        navigateToPaper(paper);
      }
    },
    [createTab, navigateToPaper],
  );

  // Handle back navigation from paper reader
  const handleBack = useCallback(() => {
    navigateToHome();
  }, [navigateToHome]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!workspacePath) {
    return (
      <>
        {/* Titlebar drag region for window dragging */}
        <div className="titlebar-drag-region" />
        <Onboarding onComplete={setWorkspace} />
      </>
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
          onSwitchTab={switchToTab}
          onCloseTab={closeTab}
          onNewTab={() => createTab("home")}
        />
      ) : (
        /* Titlebar drag region when no tabs shown */
        <div className="titlebar-drag-region" />
      )}
      {/* Render all tabs, hide inactive ones to preserve state including scroll position */}
      {tabs.map((tab) => (
        <TabPane
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          workspacePath={workspacePath}
          onBack={handleBack}
          onChangeWorkspace={clearWorkspace}
          onSelectPaper={handleSelectPaper}
        />
      ))}
    </>
  );
}

export default App;
