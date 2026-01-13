import { useState, useEffect, useCallback } from "react";
import { listPapers, importPDFFromPath, type Paper } from "@/lib/papers";

export interface UsePapersReturn {
  papers: Paper[];
  isLoading: boolean;
  error: string | null;
  importFromPaths: (paths: string[]) => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePapers(workspacePath: string | null): UsePapersReturn {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspacePath) {
      setPapers([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const loadedPapers = await listPapers(workspacePath);
      setPapers(loadedPapers);
    } catch (err) {
      console.error("Failed to load papers:", err);
      setError(err instanceof Error ? err.message : "Failed to load papers");
    } finally {
      setIsLoading(false);
    }
  }, [workspacePath]);

  // Load papers when workspace changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  const importFromPaths = useCallback(
    async (paths: string[]) => {
      if (!workspacePath) {
        setError("No workspace selected");
        return;
      }

      setError(null);
      const errors: string[] = [];

      for (const path of paths) {
        try {
          const paper = await importPDFFromPath(workspacePath, path);
          setPapers((prev) => [paper, ...prev]);
        } catch (err) {
          const filename = path.split("/").pop() || path;
          const message =
            err instanceof Error ? err.message : `Failed to import ${filename}`;
          errors.push(message);
          console.error("Failed to import PDF:", err);
        }
      }

      if (errors.length > 0) {
        setError(errors.join("; "));
      }
    },
    [workspacePath],
  );

  return {
    papers,
    isLoading,
    error,
    importFromPaths,
    refresh,
  };
}
