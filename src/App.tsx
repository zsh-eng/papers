import { useWorkspace } from "@/hooks/use-workspace";
import { useTabs } from "@/hooks/use-tabs";
import { useTabKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Onboarding } from "@/components/onboarding";
import { PaperLibrary } from "@/components/paper-library";
import { PaperReader } from "@/components/paper-reader";
import { TabBar } from "@/components/tab-bar";
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
    activeTab,
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

  // Render content based on active tab
  const renderContent = () => {
    if (activeTab.type === "paper" && activeTab.paper) {
      return (
        <PaperReader
          paper={activeTab.paper}
          onBack={handleBack}
        />
      );
    }

    return (
      <PaperLibrary
        workspacePath={workspacePath}
        onChangeWorkspace={clearWorkspace}
        onSelectPaper={handleSelectPaper}
      />
    );
  };

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
      {renderContent()}
    </>
  );
}

export default App;
