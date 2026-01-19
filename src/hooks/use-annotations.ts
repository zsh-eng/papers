import {
  generateAnnotationId,
  loadAnnotations,
  saveAnnotations,
  type Annotation,
  type AnnotationColor,
  type TextPosition,
} from "@/lib/annotations";
import { broadcastInvalidation } from "@/lib/query-invalidation";
import { queryKeys } from "@/lib/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

// Debounce delay for auto-save (ms)
const AUTO_SAVE_DELAY = 1500;

/**
 * Query hook for fetching paper annotations.
 */
export function useAnnotationsQuery(paperPath: string) {
  return useQuery({
    queryKey: queryKeys.paperAnnotations(paperPath),
    queryFn: () => loadAnnotations(paperPath),
  });
}

/**
 * Mutation hook for saving annotations with cross-webview sync.
 */
export function useSaveAnnotationsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paperPath,
      annotations,
    }: {
      paperPath: string;
      annotations: Annotation[];
    }) => {
      await saveAnnotations(paperPath, annotations);
    },
    onSuccess: (_, { paperPath }) => {
      const queryKey = queryKeys.paperAnnotations(paperPath);
      queryClient.invalidateQueries({ queryKey });
      broadcastInvalidation(queryKey);
    },
  });
}

/**
 * Mutation hook for creating an annotation with optimistic update.
 */
export function useCreateAnnotationMutation(paperPath: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.paperAnnotations(paperPath);

  return useMutation({
    mutationFn: async (annotation: Annotation) => {
      const current = queryClient.getQueryData<Annotation[]>(queryKey) ?? [];
      const updated = [...current, annotation];
      await saveAnnotations(paperPath, updated);
      return updated;
    },
    onMutate: async (annotation) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousAnnotations =
        queryClient.getQueryData<Annotation[]>(queryKey);

      // Optimistically update to the new value
      queryClient.setQueryData<Annotation[]>(queryKey, (old) => [
        ...(old ?? []),
        annotation,
      ]);

      return { previousAnnotations };
    },
    onError: (_, __, context) => {
      // Rollback on error
      if (context?.previousAnnotations) {
        queryClient.setQueryData(queryKey, context.previousAnnotations);
      }
    },
    onSettled: () => {
      broadcastInvalidation(queryKey);
    },
  });
}

/**
 * Mutation hook for deleting an annotation with optimistic update.
 */
export function useDeleteAnnotationMutation(paperPath: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.paperAnnotations(paperPath);

  return useMutation({
    mutationFn: async (annotationId: string) => {
      const current = queryClient.getQueryData<Annotation[]>(queryKey) ?? [];
      const updated = current.filter((ann) => ann.id !== annotationId);
      await saveAnnotations(paperPath, updated);
      return updated;
    },
    onMutate: async (annotationId) => {
      await queryClient.cancelQueries({ queryKey });

      const previousAnnotations =
        queryClient.getQueryData<Annotation[]>(queryKey);

      queryClient.setQueryData<Annotation[]>(queryKey, (old) =>
        (old ?? []).filter((ann) => ann.id !== annotationId),
      );

      return { previousAnnotations };
    },
    onError: (_, __, context) => {
      if (context?.previousAnnotations) {
        queryClient.setQueryData(queryKey, context.previousAnnotations);
      }
    },
    onSettled: () => {
      broadcastInvalidation(queryKey);
    },
  });
}

/**
 * Hook that manages annotations with debounced saving.
 * Uses React Query cache as the source of truth with optimistic updates.
 */
export function useAnnotations(paperPath: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.paperAnnotations(paperPath);

  const {
    data: annotations = [],
    isLoading,
    error,
  } = useAnnotationsQuery(paperPath);

  // Refs for debounced saving
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef(false);
  const latestAnnotationsRef = useRef<Annotation[]>(annotations);

  // Keep ref in sync with query data
  useEffect(() => {
    latestAnnotationsRef.current = annotations;
  }, [annotations]);

  // Save function
  const saveToFile = useCallback(
    async (annotationsToSave: Annotation[]) => {
      try {
        await saveAnnotations(paperPath, annotationsToSave);
        pendingSaveRef.current = false;
        broadcastInvalidation(queryKey);
      } catch (err) {
        console.error("Failed to save annotations:", err);
        // Re-fetch to restore correct state on error
        queryClient.invalidateQueries({ queryKey });
      }
    },
    [paperPath, queryKey, queryClient],
  );

  // Debounced save trigger
  const scheduleSave = useCallback(
    (newAnnotations: Annotation[]) => {
      pendingSaveRef.current = true;
      latestAnnotationsRef.current = newAnnotations;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveToFile(latestAnnotationsRef.current);
      }, AUTO_SAVE_DELAY);
    },
    [saveToFile],
  );

  // Create annotation handler
  const createAnnotation = useCallback(
    (position: TextPosition, color: AnnotationColor) => {
      const now = new Date().toISOString();
      const newAnnotation: Annotation = {
        id: generateAnnotationId(),
        source: "html",
        color,
        createdAt: now,
        updatedAt: now,
        position,
      };

      // Optimistic update
      const newAnnotations = [...latestAnnotationsRef.current, newAnnotation];
      queryClient.setQueryData<Annotation[]>(queryKey, newAnnotations);
      scheduleSave(newAnnotations);
    },
    [queryClient, queryKey, scheduleSave],
  );

  // Delete annotation handler
  const deleteAnnotation = useCallback(
    (id: string) => {
      const newAnnotations = latestAnnotationsRef.current.filter(
        (ann) => ann.id !== id,
      );
      queryClient.setQueryData<Annotation[]>(queryKey, newAnnotations);
      scheduleSave(newAnnotations);
    },
    [queryClient, queryKey, scheduleSave],
  );

  // Update annotation handler
  const updateAnnotation = useCallback(
    (id: string, updates: Partial<Pick<Annotation, "color" | "note">>) => {
      const now = new Date().toISOString();
      const newAnnotations = latestAnnotationsRef.current.map((ann) =>
        ann.id === id ? { ...ann, ...updates, updatedAt: now } : ann,
      );
      queryClient.setQueryData<Annotation[]>(queryKey, newAnnotations);
      scheduleSave(newAnnotations);
    },
    [queryClient, queryKey, scheduleSave],
  );

  // Cleanup on unmount - save any pending changes
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (pendingSaveRef.current) {
        // Sync save on unmount
        saveAnnotations(paperPath, latestAnnotationsRef.current).catch(
          console.error,
        );
      }
    };
  }, [paperPath]);

  return {
    annotations,
    isLoading,
    error,
    createAnnotation,
    deleteAnnotation,
    updateAnnotation,
  };
}
