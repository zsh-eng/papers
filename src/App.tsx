import { useWorkspace } from "@/hooks/use-workspace";
import { Onboarding } from "@/components/onboarding";
import { PaperLibrary } from "@/components/paper-library";

function LoadingScreen() {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

export function App() {
  const { workspacePath, isLoading, setWorkspace, clearWorkspace } = useWorkspace();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!workspacePath) {
    return <Onboarding onComplete={setWorkspace} />;
  }

  return (
    <PaperLibrary
      workspacePath={workspacePath}
      onChangeWorkspace={clearWorkspace}
    />
  );
}

export default App;
