import { createFolder, pathExists } from "@/lib/fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { useEffect, useState } from "react";

export interface UseWorkspaceReturn {
  workspacePath: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useWorkspace(): UseWorkspaceReturn {
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize workspace to app data directory on mount
  useEffect(() => {
    async function initWorkspace() {
      try {
        // Get the app data directory (e.g., ~/Library/Application Support/app.papers.reader/)
        const dataDir = await appDataDir();
        const papersPath = await join(dataDir, "papers");

        // Create papers subdirectory if it doesn't exist
        const papersExists = await pathExists(papersPath);
        if (!papersExists) {
          await createFolder(dataDir, "papers");
        }

        setWorkspacePath(dataDir);
      } catch (err) {
        console.error("Failed to initialize workspace:", err);
        setError(
          err instanceof Error ? err.message : "Failed to initialize workspace",
        );
      } finally {
        setIsLoading(false);
      }
    }

    initWorkspace();
  }, []);

  return {
    workspacePath,
    isLoading,
    error,
  };
}
