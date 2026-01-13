import { useState, useCallback, useEffect } from "react";
import {
  listDirectory,
  createFile,
  createFolder,
  deleteItem,
  type FileEntry,
} from "@/lib/fs";

export interface UseFileExplorerReturn {
  // State
  rootPath: string | null;
  currentPath: string | null;
  entries: FileEntry[];
  loading: boolean;
  error: string | null;

  // Navigation
  setRoot: (path: string) => Promise<void>;
  navigateTo: (path: string) => Promise<void>;
  goUp: () => Promise<void>;
  goBack: () => void;
  refresh: () => Promise<void>;

  // Computed
  breadcrumbs: { name: string; path: string }[];
  canGoUp: boolean;
  canGoBack: boolean;

  // Actions
  handleCreateFile: (name: string) => Promise<void>;
  handleCreateFolder: (name: string) => Promise<void>;
  handleDelete: (path: string) => Promise<void>;
}

export function useFileExplorer(): UseFileExplorerReturn {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const items = await listDirectory(path);
      setEntries(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load directory");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const setRoot = useCallback(
    async (path: string) => {
      try {
        setRootPath(path);
        setCurrentPath(path);
        setHistory([]);
        await loadDirectory(path);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to set root directory",
        );
      }
    },
    [loadDirectory],
  );

  const navigateTo = useCallback(
    async (path: string) => {
      if (currentPath) {
        setHistory((prev) => [...prev, currentPath]);
      }
      setCurrentPath(path);
      await loadDirectory(path);
    },
    [currentPath, loadDirectory],
  );

  const goUp = useCallback(async () => {
    if (!currentPath || !rootPath || currentPath === rootPath) return;

    const parentPath = currentPath.split("/").slice(0, -1).join("/");
    if (parentPath.length >= rootPath.length) {
      if (currentPath) {
        setHistory((prev) => [...prev, currentPath]);
      }
      setCurrentPath(parentPath);
      await loadDirectory(parentPath);
    }
  }, [currentPath, rootPath, loadDirectory]);

  const goBack = useCallback(() => {
    if (history.length === 0) return;

    const previousPath = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setCurrentPath(previousPath);
    loadDirectory(previousPath);
  }, [history, loadDirectory]);

  const refresh = useCallback(async () => {
    if (currentPath) {
      await loadDirectory(currentPath);
    }
  }, [currentPath, loadDirectory]);

  const handleCreateFile = useCallback(
    async (name: string) => {
      if (!currentPath) return;
      try {
        await createFile(currentPath, name);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create file");
      }
    },
    [currentPath, refresh],
  );

  const handleCreateFolder = useCallback(
    async (name: string) => {
      if (!currentPath) return;
      try {
        await createFolder(currentPath, name);
        await refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create folder",
        );
      }
    },
    [currentPath, refresh],
  );

  const handleDelete = useCallback(
    async (path: string) => {
      try {
        await deleteItem(path);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete item");
      }
    },
    [refresh],
  );

  // Compute breadcrumbs
  const breadcrumbs = (() => {
    if (!currentPath || !rootPath) return [];

    const rootName = rootPath.split("/").pop() || rootPath;
    const relativePath = currentPath.slice(rootPath.length);
    const parts = relativePath.split("/").filter(Boolean);

    const crumbs = [{ name: rootName, path: rootPath }];

    let accumulatedPath = rootPath;
    for (const part of parts) {
      accumulatedPath = `${accumulatedPath}/${part}`;
      crumbs.push({ name: part, path: accumulatedPath });
    }

    return crumbs;
  })();

  const canGoUp = !!(currentPath && rootPath && currentPath !== rootPath);
  const canGoBack = history.length > 0;

  // Auto-refresh when currentPath changes
  useEffect(() => {
    if (currentPath && !loading) {
      // Already loaded in the navigation functions
    }
  }, [currentPath]);

  return {
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
  };
}
