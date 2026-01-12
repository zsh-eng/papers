import { useEffect, useState, useMemo } from "react";
import { renderMarkdownBody, parseFrontmatter, type ParsedFrontmatter } from "@/lib/markdown";
import { cn } from "@/lib/utils";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  const [html, setHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parse frontmatter synchronously
  const frontmatter: ParsedFrontmatter = useMemo(() => {
    return parseFrontmatter(content);
  }, [content]);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      setIsLoading(true);
      setError(null);

      try {
        const rendered = await renderMarkdownBody(content);
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
    <div className={cn(className)}>
      <div className="max-w-[700px] mx-auto">
        {/* Paper title hero section - positioned ~1/3 down */}
        <div className="pt-[33vh] pb-16">
          {frontmatter.title && (
            <h1 className="paper-title">{frontmatter.title}</h1>
          )}
          
          {/* Paper authors */}
          {frontmatter.authors && frontmatter.authors.length > 0 && (
            <div className="paper-authors">
              {frontmatter.authors.join(" · ")}
            </div>
          )}
        </div>
        
        {/* Paper body */}
        <div
          className="markdown-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
