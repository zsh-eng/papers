import { useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getPapersDir, type LibraryItem } from "@/lib/papers";
import { useLibraryItemsQuery } from "@/hooks/use-papers-query";
import { createFolder, deleteItem, pathExists } from "@/lib/fs";
import { mkdir } from "@tauri-apps/plugin-fs";
import { broadcastInvalidation } from "@/lib/query-invalidation";
import { queryKeys } from "@/lib/query-keys";

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
  navigateTo: (path: string) => void;
  navigateUp: () => void;
  canNavigateUp: boolean;

  // Actions
  createNewFolder: (name: string) => Promise<void>;
  deleteLibraryItem: (path: string) => Promise<void>;
  refresh: () => void;
}

export function usePaperLibrary(
  workspacePath: string | null,
): UsePaperLibraryReturn {
  const queryClient = useQueryClient();
  const papersDir = workspacePath ? getPapersDir(workspacePath) : null;

  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Initialize currentPath to papersDir when it becomes available
  const effectiveCurrentPath = currentPath ?? papersDir;

  // Use TanStack Query for fetching library items
  const {
    data: items = [],
    isLoading,
    error: queryError,
    refetch,
  } = useLibraryItemsQuery(effectiveCurrentPath);

  // Combine query error with action error
  const error =
    actionError || (queryError instanceof Error ? queryError.message : null);

  /**
   * Navigate to a specific directory
   */
  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path);
    setActionError(null);
  }, []);

  /**
   * Navigate up one level (but not above papersDir)
   */
  const navigateUp = useCallback(() => {
    if (!effectiveCurrentPath || !papersDir) return;
    if (effectiveCurrentPath === papersDir) return;

    const parentPath = effectiveCurrentPath.split("/").slice(0, -1).join("/");
    if (parentPath.length >= papersDir.length) {
      setCurrentPath(parentPath);
      setActionError(null);
    }
  }, [effectiveCurrentPath, papersDir]);

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
   * Create a new folder in the current directory
   */
  const createNewFolder = useCallback(
    async (name: string) => {
      if (!effectiveCurrentPath) return;

      setActionError(null);

      try {
        // Ensure directory exists
        if (!(await pathExists(effectiveCurrentPath))) {
          await mkdir(effectiveCurrentPath, { recursive: true });
        }
        await createFolder(effectiveCurrentPath, name);
        // Invalidate the query to refetch
        const queryKey = queryKeys.libraryItems(effectiveCurrentPath);
        queryClient.invalidateQueries({ queryKey });
        broadcastInvalidation(queryKey);
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Failed to create folder",
        );
      }
    },
    [effectiveCurrentPath, queryClient],
  );

  /**
   * Delete an item (folder or paper)
   */
  const deleteLibraryItem = useCallback(
    async (path: string) => {
      if (!effectiveCurrentPath) return;

      setActionError(null);

      try {
        await deleteItem(path);
        // Invalidate the query to refetch
        const queryKey = queryKeys.libraryItems(effectiveCurrentPath);
        queryClient.invalidateQueries({ queryKey });
        broadcastInvalidation(queryKey);
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Failed to delete item",
        );
      }
    },
    [effectiveCurrentPath, queryClient],
  );

  /**
   * Refresh the current view
   */
  const refresh = useCallback(() => {
    if (effectiveCurrentPath) {
      queryClient.invalidateQueries({
        queryKey: ["libraryItems", effectiveCurrentPath],
      });
      refetch();
    }
  }, [effectiveCurrentPath, queryClient, refetch]);

  return {
    currentPath: effectiveCurrentPath || "",
    items,
    isLoading,
    error,
    breadcrumbs,
    navigateTo,
    navigateUp,
    canNavigateUp,
    createNewFolder,
    deleteLibraryItem,
    refresh,
  };
}
