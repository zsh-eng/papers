import { useEffect, useState } from "react";
import { renderMarkdownContent } from "@/lib/markdown";
import { cn } from "@/lib/utils";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  const [html, setHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      setIsLoading(true);
      setError(null);

      try {
        const rendered = await renderMarkdownContent(content);
        if (!cancelled) {
          setHtml(rendered);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render markdown");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [content]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <div className="text-muted-foreground animate-pulse">Rendering...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-4", className)}>
        <div className="text-destructive text-sm">Error: {error}</div>
      </div>
    );
  }

  return (
    <div
      className={cn("markdown-content overflow-auto", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
