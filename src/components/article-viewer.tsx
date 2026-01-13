import { cn } from "@/lib/utils";

interface ArticleViewerProps {
  /** Pre-rendered HTML content */
  html: string;
  /** Article title (from frontmatter) */
  title?: string;
  /** Article authors (from frontmatter) */
  authors?: string[];
  className?: string;
}

/**
 * A pure HTML renderer for articles/papers.
 * Expects pre-rendered HTML - does not do any markdown processing.
 */
export function ArticleViewer({
  html,
  title,
  authors,
  className,
}: ArticleViewerProps) {
  return (
    <div className={cn(className)}>
      {/* Paper title hero section - positioned ~1/3 down */}
      <div className="pt-[33vh] pb-16 max-w-[700px] mx-auto">
        {title && <h1 className="paper-title">{title}</h1>}

        {/* Paper authors */}
        {authors && authors.length > 0 && (
          <div className="paper-authors">{authors.join(" · ")}</div>
        )}
      </div>

      {/* Paper body */}
      <div
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
