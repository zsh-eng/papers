import { broadcastInvalidation } from "@/lib/query-invalidation";
import { queryKeys } from "@/lib/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useCallback, useEffect, useRef } from "react";
import { usePaperNotesQuery } from "./use-paper-content";

// Debounce delay for auto-save (ms)
const AUTO_SAVE_DELAY = 1500;

/**
 * Hook that manages notes with debounced saving.
 * Uses React Query cache as the source of truth with optimistic updates.
 */
export function useNotes(paperPath: string, paperTitle: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.paperNotes(paperPath);

  const { data: notes, isLoading } = usePaperNotesQuery(paperPath, paperTitle);

  // Refs for debounced saving
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef(false);
  const latestNotesRef = useRef<string>(notes ?? "");

  // Keep ref in sync with query data
  useEffect(() => {
    if (notes !== undefined) {
      latestNotesRef.current = notes;
    }
  }, [notes]);

  // Save function
  const saveToFile = useCallback(
    async (notesToSave: string) => {
      const notesPath = `${paperPath}/notes.md`;
      try {
        await writeTextFile(notesPath, notesToSave);
        pendingSaveRef.current = false;
        broadcastInvalidation(queryKey);
      } catch (err) {
        console.error("Failed to save notes:", err);
        // Re-fetch to restore correct state on error
        queryClient.invalidateQueries({ queryKey });
      }
    },
    [paperPath, queryKey, queryClient],
  );

  // Debounced save trigger
  const scheduleSave = useCallback(
    (newNotes: string) => {
      pendingSaveRef.current = true;
      latestNotesRef.current = newNotes;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveToFile(latestNotesRef.current);
      }, AUTO_SAVE_DELAY);
    },
    [saveToFile],
  );

  // Update notes handler - optimistic update + debounced save
  const updateNotes = useCallback(
    (newContent: string) => {
      // Optimistic update
      queryClient.setQueryData<string>(queryKey, newContent);
      scheduleSave(newContent);
    },
    [queryClient, queryKey, scheduleSave],
  );

  // Check if there are pending changes
  const hasPendingChanges = useCallback(() => {
    return pendingSaveRef.current;
  }, []);

  // Cleanup on unmount - save any pending changes
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (pendingSaveRef.current) {
        // Sync save on unmount
        const notesPath = `${paperPath}/notes.md`;
        writeTextFile(notesPath, latestNotesRef.current).catch(console.error);
      }
    };
  }, [paperPath]);

  return {
    notes,
    isLoading,
    updateNotes,
    hasPendingChanges,
  };
}
