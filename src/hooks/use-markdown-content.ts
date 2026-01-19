import { renderMarkdownBody } from "@/lib/extract/render";
import { extractAuthor, parseMarkdown } from "@/lib/markdown";
import { queryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { readTextFile } from "@tauri-apps/plugin-fs";

export interface MarkdownContent {
  html: string;
  author: string | undefined;
}

/**
 * Query hook for fetching and rendering markdown content.
 */
export function useMarkdownContentQuery(filePath: string) {
  return useQuery({
    queryKey: queryKeys.markdownContent(filePath),
    queryFn: async (): Promise<MarkdownContent> => {
      const content = await readTextFile(filePath);
      const parsed = parseMarkdown(content);
      const author = extractAuthor(parsed);
      const html = await renderMarkdownBody(content);
      return { html, author };
    },
  });
}
