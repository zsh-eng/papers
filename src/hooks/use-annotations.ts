import {
  loadAnnotations,
  saveAnnotations,
  type Annotation,
} from "@/lib/annotations";
import { broadcastInvalidation } from "@/lib/query-invalidation";
import { queryKeys } from "@/lib/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
