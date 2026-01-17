import { ArticleViewer } from "@/components/article-viewer";
import { renderMarkdownBody } from "@/lib/extract/render";
import { extractAuthor, parseMarkdown } from "@/lib/markdown";
import type { MarkdownFile } from "@/lib/papers";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useEffect, useState } from "react";

interface MarkdownReaderProps {
  markdown: MarkdownFile;
  onBack: () => void;
}

export function MarkdownReader({ markdown, onBack }: MarkdownReaderProps) {
  const [html, setHtml] = useState<string>("");
  const [author, setAuthor] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load and render markdown content
  useEffect(() => {
    async function loadContent() {
      setIsLoading(true);
      setError(null);
      try {
        const content = await readTextFile(markdown.path);
        const parsed = parseMarkdown(content);

        // Extract author from frontmatter
        const parsedAuthor = extractAuthor(parsed);
        setAuthor(parsedAuthor);

        // Render markdown body (strips frontmatter and first H1)
        const renderedHtml = await renderMarkdownBody(content);
        setHtml(renderedHtml);
      } catch (err) {
        console.error("Failed to load markdown:", err);
        setError("Failed to load markdown file.");
      } finally {
        setIsLoading(false);
      }
    }
    loadContent();
  }, [markdown.path]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc to go back
      if (e.key === "Escape") {
        const activeElement = document.activeElement;
        const isInputFocused =
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement?.hasAttribute("contenteditable");

        if (!isInputFocused && activeElement === document.body) {
          onBack();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  return (
    <div className="min-h-screen bg-background">
      {/* Error banner */}
      {error && (
        <div className="fixed top-0 left-0 right-0 z-30 px-4 py-2 bg-destructive/10 text-destructive text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main content */}
      {!isLoading && (
        <div
          className="fixed top-0 bottom-0 left-0 right-0 overflow-auto"
          style={{ paddingTop: "3rem" }}
        >
          <ArticleViewer
            html={html}
            title={markdown.metadata.title}
            authors={author ? [author] : undefined}
            className="pb-32 px-6 paper-scroll-container"
          />
        </div>
      )}
    </div>
  );
}
