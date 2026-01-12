import { usePapers } from "@/hooks/use-papers";
import type { Paper } from "@/lib/papers";
import { cn } from "@/lib/utils";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useMemo, useState } from "react";

interface PaperLibraryProps {
  workspacePath: string;
  onChangeWorkspace: () => void;
  onSelectPaper: (paper: Paper) => void;
}

function PaperItem({ paper, onClick }: { paper: Paper; onClick: () => void }) {
  const { metadata } = paper;
  const displayTitle = metadata.title || paper.filename;
  const displayAuthors =
    metadata.authors.length > 0
      ? metadata.authors.length > 2
        ? `${metadata.authors[0]} et al.`
        : metadata.authors.join(", ")
      : null;

  return (
    <div
      className="py-4 cursor-pointer group"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <p className="font-medium text-foreground group-hover:text-foreground/70 transition-colors">
        {displayTitle}
      </p>
      {displayAuthors && (
        <p className="text-sm text-muted-foreground mt-1">{displayAuthors}</p>
      )}
      {metadata.year && (
        <p className="text-sm text-muted-foreground/60 mt-0.5">
          {metadata.year}
        </p>
      )}
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

  // Sort papers alphabetically by title
  const sortedPapers = useMemo(() => {
    return [...papers].sort((a, b) => {
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
      {/* Badge - with titlebar inset for traffic lights */}
      <div className="px-8 pt-[calc(var(--titlebar-height)+1.5rem)]">
        <div className="flex items-center gap-3 font-mono text-base tracking-widest uppercase text-foreground">
          <span className="text-foreground text-lg">■</span>
          <span>
            {paperCount} {paperCount === 1 ? "PAPER" : "PAPERS"}
          </span>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto px-20 py-8">
        {/* Error message */}
        {error && <div className="mb-6 text-sm text-destructive">{error}</div>}

        {/* Papers list */}
        <div className="space-y-1">
          {sortedPapers.length === 0 && !isLoading ? (
            <div className="text-muted-foreground">
              <p className="text-sm">No papers yet</p>
              <p className="text-xs mt-1 text-muted-foreground/60">
                Drop PDFs anywhere to get started
              </p>
            </div>
          ) : (
            sortedPapers.map((paper) => (
              <PaperItem
                key={paper.id}
                paper={paper}
                onClick={() => onSelectPaper(paper)}
              />
            ))
          )}
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
