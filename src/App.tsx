import { useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Onboarding } from "@/components/onboarding";
import { PaperLibrary } from "@/components/paper-library";
import { PaperReader } from "@/components/paper-reader";
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
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);

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

  // Show paper reader if a paper is selected
  if (selectedPaper) {
    return (
      <>
        {/* Titlebar drag region for window dragging */}
        <div className="titlebar-drag-region" />
        <PaperReader
          paper={selectedPaper}
          onBack={() => setSelectedPaper(null)}
        />
      </>
    );
  }

  return (
    <>
      {/* Titlebar drag region for window dragging */}
      <div className="titlebar-drag-region" />
      <PaperLibrary
        workspacePath={workspacePath}
        onChangeWorkspace={clearWorkspace}
        onSelectPaper={setSelectedPaper}
      />
    </>
  );
}

export default App;
