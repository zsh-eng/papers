import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "./breadcrumbs";
import { Toolbar } from "./toolbar";
import { FileList } from "./file-list";
import { useFileExplorer } from "@/hooks/use-file-explorer";

export function FileExplorer() {
  const [pathInput, setPathInput] = useState("");

  const {
    rootPath,
    currentPath,
    entries,
    loading,
    error,
    setRoot,
    navigateTo,
    goUp,
    goBack,
    refresh,
    breadcrumbs,
    canGoUp,
    canGoBack,
    handleCreateFile,
    handleCreateFolder,
    handleDelete,
  } = useFileExplorer();

  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select a folder to browse",
      });

      if (selected && typeof selected === "string") {
        setPathInput(selected);
        await setRoot(selected);
      }
    } catch (err) {
      console.error("Failed to open folder picker:", err);
    }
  };

  const handlePathSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pathInput.trim()) {
      await setRoot(pathInput.trim());
    }
  };

  return (
    <div className="h-screen flex flex-col p-4 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">File Explorer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePathSubmit} className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter folder path or click Browse..."
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              className="flex-1"
            />
            <Button type="button" variant="secondary" onClick={handleBrowse}>
              <FolderOpen className="h-4 w-4 mr-2" />
              Browse
            </Button>
            <Button type="submit" disabled={!pathInput.trim()}>
              Open
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardContent className="flex-1 flex flex-col p-4 min-h-0">
          <Breadcrumbs items={breadcrumbs} onNavigate={navigateTo} />

          <Toolbar
            canGoBack={canGoBack}
            canGoUp={canGoUp}
            disabled={!rootPath || loading}
            onGoBack={goBack}
            onGoUp={goUp}
            onRefresh={refresh}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
          />

          <div className="flex-1 overflow-auto mt-2">
            <FileList
              entries={entries}
              loading={loading}
              error={error}
              hasRoot={!!rootPath}
              onNavigate={navigateTo}
              onDelete={handleDelete}
            />
          </div>

          {currentPath && (
            <div className="text-xs text-muted-foreground pt-2 border-t mt-2">
              <span className="font-medium">Current path:</span> {currentPath}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
