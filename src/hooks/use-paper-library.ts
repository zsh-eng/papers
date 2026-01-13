import { useState, useCallback, useMemo } from "react";
import {
  getPapersDir,
  listLibraryItems,
  importPDFToDirectory,
  type LibraryItem,
} from "@/lib/papers";
import { createFolder, deleteItem, pathExists } from "@/lib/fs";
import { mkdir } from "@tauri-apps/plugin-fs";

export interface Breadcrumb {
  name: string;
  path: string;
}

export interface UsePaperLibraryReturn {
  // Current view state
  currentPath: string;
  items: LibraryItem[];
  isLoading: boolean;
  error: string | null;

  // Navigation
  breadcrumbs: Breadcrumb[];
  navigateTo: (path: string) => Promise<void>;
  navigateUp: () => Promise<void>;
  canNavigateUp: boolean;

  // Actions
  importFromPaths: (paths: string[]) => Promise<void>;
  createNewFolder: (name: string) => Promise<void>;
  deleteLibraryItem: (path: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePaperLibrary(
  workspacePath: string | null,
): UsePaperLibraryReturn {
  const papersDir = workspacePath ? getPapersDir(workspacePath) : null;

  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize currentPath to papersDir when it becomes available
  const effectiveCurrentPath = currentPath ?? papersDir;

  /**
   * Load items from a directory
   */
  const loadDirectory = useCallback(async (dirPath: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Ensure directory exists
      if (!(await pathExists(dirPath))) {
        await mkdir(dirPath, { recursive: true });
      }

      const libraryItems = await listLibraryItems(dirPath);
      setItems(libraryItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load directory");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Navigate to a specific directory
   */
  const navigateTo = useCallback(
    async (path: string) => {
      setCurrentPath(path);
      await loadDirectory(path);
    },
    [loadDirectory],
  );

  /**
   * Navigate up one level (but not above papersDir)
   */
  const navigateUp = useCallback(async () => {
    if (!effectiveCurrentPath || !papersDir) return;
    if (effectiveCurrentPath === papersDir) return;

    const parentPath = effectiveCurrentPath.split("/").slice(0, -1).join("/");
    if (parentPath.length >= papersDir.length) {
      setCurrentPath(parentPath);
      await loadDirectory(parentPath);
    }
  }, [effectiveCurrentPath, papersDir, loadDirectory]);

  /**
   * Check if we can navigate up
   */
  const canNavigateUp = useMemo(() => {
    if (!effectiveCurrentPath || !papersDir) return false;
    return effectiveCurrentPath !== papersDir;
  }, [effectiveCurrentPath, papersDir]);

  /**
   * Generate breadcrumbs from current path
   */
  const breadcrumbs = useMemo((): Breadcrumb[] => {
    if (!effectiveCurrentPath || !papersDir) return [];

    // Start with "papers" as the root
    const crumbs: Breadcrumb[] = [{ name: "papers", path: papersDir }];

    // Add intermediate folders
    const relativePath = effectiveCurrentPath.slice(papersDir.length);
    const parts = relativePath.split("/").filter(Boolean);

    let accumulatedPath = papersDir;
    for (const part of parts) {
      accumulatedPath = `${accumulatedPath}/${part}`;
      crumbs.push({ name: part, path: accumulatedPath });
    }

    return crumbs;
  }, [effectiveCurrentPath, papersDir]);

  /**
   * Import PDFs into the current directory
   */
  const importFromPaths = useCallback(
    async (paths: string[]) => {
      if (!effectiveCurrentPath) return;

      setIsLoading(true);
      setError(null);

      try {
        for (const sourcePath of paths) {
          await importPDFToDirectory(effectiveCurrentPath, sourcePath);
        }
        // Refresh the view
        await loadDirectory(effectiveCurrentPath);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "Failed to import papers",
        );
        // Still refresh to show any that succeeded
        await loadDirectory(effectiveCurrentPath);
      } finally {
        setIsLoading(false);
      }
    },
    [effectiveCurrentPath, loadDirectory],
  );

  /**
   * Create a new folder in the current directory
   */
  const createNewFolder = useCallback(
    async (name: string) => {
      if (!effectiveCurrentPath) return;

      setError(null);

      try {
        await createFolder(effectiveCurrentPath, name);
        await loadDirectory(effectiveCurrentPath);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create folder",
        );
      }
    },
    [effectiveCurrentPath, loadDirectory],
  );

  /**
   * Delete an item (folder or paper)
   */
  const deleteLibraryItem = useCallback(
    async (path: string) => {
      if (!effectiveCurrentPath) return;

      setError(null);

      try {
        await deleteItem(path);
        await loadDirectory(effectiveCurrentPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete item");
      }
    },
    [effectiveCurrentPath, loadDirectory],
  );

  /**
   * Refresh the current view
   */
  const refresh = useCallback(async () => {
    if (effectiveCurrentPath) {
      await loadDirectory(effectiveCurrentPath);
    }
  }, [effectiveCurrentPath, loadDirectory]);

  // Initial load when papersDir becomes available
  // This is handled by the component using useEffect

  return {
    currentPath: effectiveCurrentPath || "",
    items,
    isLoading,
    error,
    breadcrumbs,
    navigateTo,
    navigateUp,
    canNavigateUp,
    importFromPaths,
    createNewFolder,
    deleteLibraryItem,
    refresh,
  };
}
