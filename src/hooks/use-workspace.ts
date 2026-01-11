import { useState, useEffect, useCallback } from "react";
import { getWorkspacePath, setWorkspacePath, clearWorkspacePath } from "@/lib/store";
import { allowDirectory, pathExists, createFolder } from "@/lib/fs";

export interface UseWorkspaceReturn {
  workspacePath: string | null;
  isLoading: boolean;
  error: string | null;
  setWorkspace: (path: string) => Promise<void>;
  clearWorkspace: () => Promise<void>;
}

export function useWorkspace(): UseWorkspaceReturn {
  const [workspacePath, setWorkspacePathState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load workspace path from store on mount
  useEffect(() => {
    async function loadWorkspace() {
      try {
        const path = await getWorkspacePath();
        if (path) {
          // Verify the path still exists and allow access
          const exists = await pathExists(path);
          if (exists) {
            await allowDirectory(path);
            setWorkspacePathState(path);
          } else {
            // Path no longer exists, clear it
            await clearWorkspacePath();
          }
        }
      } catch (err) {
        console.error("Failed to load workspace:", err);
        setError(err instanceof Error ? err.message : "Failed to load workspace");
      } finally {
        setIsLoading(false);
      }
    }

    loadWorkspace();
  }, []);

  const setWorkspace = useCallback(async (path: string) => {
    try {
      setError(null);
      
      // Allow access to the directory
      await allowDirectory(path);
      
      // Create papers subdirectory if it doesn't exist
      const papersPath = `${path}/papers`;
      const papersExists = await pathExists(papersPath);
      if (!papersExists) {
        await createFolder(path, "papers");
      }
      
      // Save to store
      await setWorkspacePath(path);
      setWorkspacePathState(path);
    } catch (err) {
      console.error("Failed to set workspace:", err);
      setError(err instanceof Error ? err.message : "Failed to set workspace");
      throw err;
    }
  }, []);

  const clearWorkspace = useCallback(async () => {
    try {
      setError(null);
      await clearWorkspacePath();
      setWorkspacePathState(null);
    } catch (err) {
      console.error("Failed to clear workspace:", err);
      setError(err instanceof Error ? err.message : "Failed to clear workspace");
      throw err;
    }
  }, []);

  return {
    workspacePath,
    isLoading,
    error,
    setWorkspace,
    clearWorkspace,
  };
}
