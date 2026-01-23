import { ArticleViewer } from "@/components/article-viewer";
import { useCommands } from "@/hooks/use-commands";
import { useMarkdownContentQuery } from "@/hooks/use-markdown-content";
import type { MarkdownFile } from "@/lib/papers";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useEffect, useMemo, useState } from "react";

interface MarkdownReaderProps {
  markdown: MarkdownFile;
  onBack: () => void;
}

export function MarkdownReader({ markdown, onBack }: MarkdownReaderProps) {
  const {
    data: content,
    isLoading,
    error: queryError,
  } = useMarkdownContentQuery(markdown.path);

  const [dismissedError, setDismissedError] = useState(false);

  // Derive error from query error
  const error = useMemo(() => {
    if (dismissedError) return null;
    return queryError ? "Failed to load markdown file." : null;
  }, [queryError, dismissedError]);

  // Register reader-specific commands via the command registry
  useCommands(
    [
      {
        id: "reader.revealInFinder",
        title: "Reveal in Finder",
        execute: () => revealItemInDir(markdown.path),
      },
    ],
    [markdown.path],
  );

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
            onClick={() => setDismissedError(true)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main content */}
      {!isLoading && content && (
        <div
          className="fixed top-0 bottom-0 left-0 right-0 overflow-auto"
          style={{ paddingTop: "3rem" }}
        >
          <ArticleViewer
            html={content.html}
            title={markdown.metadata.title}
            authors={content.author ? [content.author] : undefined}
            className="pb-32 px-6 paper-scroll-container"
          />
        </div>
      )}
    </div>
  );
}
