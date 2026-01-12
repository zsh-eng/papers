import { usePapers } from "@/hooks/use-papers";
import type { Paper } from "@/lib/papers";
import { cn } from "@/lib/utils";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useMemo, useState } from "react";

interface PaperLibraryProps {
  workspacePath: string;
  onChangeWorkspace: () => void;
  onSelectPaper: (paper: Paper, openInNewTab: boolean) => void;
}

function PaperRow({
  paper,
  onClick,
  isHovered,
  isAnyHovered,
  onHover,
}: {
  paper: Paper;
  onClick: (openInNewTab: boolean) => void;
  isHovered: boolean;
  isAnyHovered: boolean;
  onHover: () => void;
}) {
  const { metadata } = paper;
  const displayTitle = metadata.title || paper.filename;
  const displayAuthors =
    metadata.authors.length > 0
      ? metadata.authors.length > 2
        ? `${metadata.authors[0]} et al.`
        : metadata.authors.join(", ")
      : null;

  const handleClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    const openInNewTab = e.metaKey || e.ctrlKey;
    onClick(openInNewTab);
  };

  // When hovered: title stays foreground, muted elements stay muted
  // When another row is hovered: title becomes muted/80, muted elements become muted/80
  // When nothing hovered: title is foreground, muted elements are muted
  const titleClass = cn(
    "flex-1 min-w-0 transition-colors duration-200",
    isHovered
      ? "text-foreground"
      : isAnyHovered
        ? "text-muted-foreground/80"
        : "text-foreground",
  );

  const mutedClass = cn(
    "transition-colors duration-200",
    isAnyHovered && !isHovered
      ? "text-muted-foreground/80"
      : "text-muted-foreground",
  );

  return (
    <div
      className="grid grid-cols-[4rem_1fr_minmax(12rem,auto)] gap-4 py-3 cursor-pointer border-b border-border/40 items-baseline"
      onClick={handleClick}
      onMouseEnter={onHover}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick(e);
        }
      }}
    >
      <span className={cn(mutedClass, "tabular-nums")}>
        {metadata.year || "—"}
      </span>
      <span className={titleClass}>{displayTitle}</span>
      <span className={cn(mutedClass, "text-right truncate")}>
        {displayAuthors || "—"}
      </span>
    </div>
  );
}

export function PaperLibrary({
  workspacePath,
  onSelectPaper,
}: PaperLibraryProps) {
  const { papers, isLoading, error, importFromPaths } =
    usePapers(workspacePath);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hoveredPaperId, setHoveredPaperId] = useState<string | null>(null);

  // Sort papers by year (newest first), then alphabetically by title
  const sortedPapers = useMemo(() => {
    return [...papers].sort((a, b) => {
      // Sort by year descending first
      const yearA = a.metadata.year || 0;
      const yearB = b.metadata.year || 0;
      if (yearB !== yearA) {
        return yearB - yearA;
      }
      // Then alphabetically by title
      const titleA = (a.metadata.title || a.filename).toLowerCase();
      const titleB = (b.metadata.title || b.filename).toLowerCase();
      return titleA.localeCompare(titleB);
    });
  }, [papers]);

  // Full-page drag and drop
  useEffect(() => {
    const webview = getCurrentWebview();

    const setupListener = async () => {
      const unlisten = await webview.onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setIsDragOver(true);
        } else if (event.payload.type === "drop") {
          setIsDragOver(false);

          const paths = event.payload.paths.filter((path) => {
            const ext = `.${path.split(".").pop()?.toLowerCase()}`;
            return ext === ".pdf";
          });

          if (paths.length > 0) {
            importFromPaths(paths);
          }
        } else if (event.payload.type === "leave") {
          setIsDragOver(false);
        }
      });

      return unlisten;
    };

    const unlistenPromise = setupListener();

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [importFromPaths]);

  const paperCount = papers.length;

  return (
    <div
      className={cn(
        "h-screen flex flex-col transition-colors",
        isDragOver && "bg-muted/30",
      )}
    >
      {/* Main content - centered */}
      <main className="flex-1 overflow-auto pt-[calc(var(--titlebar-height)+3rem)]">
        <div className="max-w-4xl mx-auto px-8">
          {/* Header */}
          <div className="flex items-center gap-3 font-mono text-base tracking-widest uppercase text-foreground mb-8 pb-4 border-b border-border">
            <span className="text-foreground text-lg">■</span>
            <span>
              {paperCount} {paperCount === 1 ? "PAPER" : "PAPERS"}
            </span>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 text-sm text-destructive">{error}</div>
          )}

          {/* Papers table */}
          <div onMouseLeave={() => setHoveredPaperId(null)}>
            {sortedPapers.length === 0 && !isLoading ? (
              <div className="text-muted-foreground py-8">
                <p className="text-sm">No papers yet</p>
                <p className="text-xs mt-1 text-muted-foreground/60">
                  Drop PDFs anywhere to get started
                </p>
              </div>
            ) : (
              sortedPapers.map((paper) => (
                <PaperRow
                  key={paper.id}
                  paper={paper}
                  onClick={(openInNewTab: boolean) =>
                    onSelectPaper(paper, openInNewTab)
                  }
                  isHovered={hoveredPaperId === paper.id}
                  isAnyHovered={hoveredPaperId !== null}
                  onHover={() => setHoveredPaperId(paper.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Drag overlay hint */}
        {isDragOver && (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
            <p className="font-mono text-sm tracking-wide text-muted-foreground">
              Drop to add
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
