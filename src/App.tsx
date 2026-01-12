import { useWorkspace } from "@/hooks/use-workspace";
import { useTabs } from "@/hooks/use-tabs";
import { useTabKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Onboarding } from "@/components/onboarding";
import { PaperLibrary } from "@/components/paper-library";
import { PaperReader } from "@/components/paper-reader";
import { TabBar } from "@/components/tab-bar";
import { cn } from "@/lib/utils";
import type { Paper } from "@/lib/papers";

function LoadingScreen() {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

export function App() {
  const { workspacePath, isLoading, setWorkspace, clearWorkspace } = useWorkspace();
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
  const handleSelectPaper = (paper: Paper, openInNewTab: boolean) => {
    if (openInNewTab) {
      createTab("paper", paper);
    } else {
      navigateToPaper(paper);
    }
  };

  // Handle back navigation from paper reader
  const handleBack = () => {
    navigateToHome();
  };

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
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={cn(
              "fixed inset-0 top-[var(--titlebar-height)] overflow-y-auto",
              isActive
                ? "visible z-10"
                : "invisible z-0 pointer-events-none"
            )}
          >
            {tab.type === "paper" && tab.paper ? (
              <PaperReader
                paper={tab.paper}
                onBack={handleBack}
              />
            ) : (
              <PaperLibrary
                workspacePath={workspacePath}
                onChangeWorkspace={clearWorkspace}
                onSelectPaper={handleSelectPaper}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export default App;
