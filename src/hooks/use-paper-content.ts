import { broadcastInvalidation } from "@/lib/query-invalidation";
import { queryKeys } from "@/lib/query-keys";
import { transformImageSources } from "@/lib/html";
import type { Paper } from "@/lib/papers";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

/**
 * Query hook for fetching and transforming paper HTML content.
 */
export function usePaperHtmlQuery(paper: Paper) {
  return useQuery({
    queryKey: queryKeys.paperHtml(paper.path),
    queryFn: async () => {
      const htmlContent = await readTextFile(paper.htmlPath);
      return transformImageSources(htmlContent, paper.path);
    },
  });
}

/**
 * Query hook for fetching paper notes.
 */
export function usePaperNotesQuery(paperPath: string, paperTitle: string) {
  return useQuery({
    queryKey: queryKeys.paperNotes(paperPath),
    queryFn: async () => {
      const notesPath = `${paperPath}/notes.md`;
      try {
        return await readTextFile(notesPath);
      } catch {
        // Notes file doesn't exist yet, return default content
        return `# Notes: ${paperTitle}\n\n*Add your notes about this paper here.*\n`;
      }
    },
  });
}

/**
 * Mutation hook for saving paper notes with cross-webview sync.
 */
export function useSaveNotesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paperPath,
      content,
    }: {
      paperPath: string;
      content: string;
    }) => {
      const notesPath = `${paperPath}/notes.md`;
      await writeTextFile(notesPath, content);
    },
    onSuccess: (_, { paperPath }) => {
      const queryKey = queryKeys.paperNotes(paperPath);
      queryClient.invalidateQueries({ queryKey });
      broadcastInvalidation(queryKey);
    },
  });
}
