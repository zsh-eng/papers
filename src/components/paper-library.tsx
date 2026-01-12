import { FileText, FolderOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/drop-zone";
import { usePapers } from "@/hooks/use-papers";
import type { Paper } from "@/lib/papers";

interface PaperLibraryProps {
  workspacePath: string;
  onChangeWorkspace: () => void;
  onSelectPaper: (paper: Paper) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
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
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate" title={displayTitle}>
          {displayTitle}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {displayAuthors && <span>{displayAuthors}</span>}
          {displayAuthors && metadata.year && <span> • </span>}
          {metadata.year && <span>{metadata.year}</span>}
          {(displayAuthors || metadata.year) && <span> • </span>}
          {formatFileSize(paper.size)}
        </p>
      </div>
    </div>
  );
}

export function PaperLibrary({
  workspacePath,
  onChangeWorkspace,
  onSelectPaper,
}: PaperLibraryProps) {
  const { papers, isLoading, error, importFromPaths, refresh } =
    usePapers(workspacePath);

  const handleDrop = (paths: string[]) => {
    importFromPaths(paths);
  };

  // Extract workspace folder name
  const workspaceName = workspacePath.split("/").pop() || workspacePath;

  return (
    <div className="h-screen flex flex-col">
      {/* Header - with titlebar inset for traffic lights */}
      <header className="flex items-center justify-between px-4 py-3 border-b pt-[calc(var(--titlebar-height)+0.75rem)] pl-[var(--traffic-light-padding)]">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <span className="font-semibold">Papers</span>
          <span className="text-muted-foreground text-sm">•</span>
          <span className="text-muted-foreground text-sm truncate max-w-[200px]">
            {workspaceName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
          <Button variant="ghost" size="sm" onClick={onChangeWorkspace}>
            <FolderOpen className="w-4 h-4 mr-1" />
            Change
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Drop zone */}
          <DropZone onDrop={handleDrop} className="min-h-[140px]" />

          {/* Error message */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Papers list */}
          <div className="space-y-2">
            {papers.length === 0 && !isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No papers yet</p>
                <p className="text-xs mt-1">
                  Drop some PDFs above to get started
                </p>
              </div>
            ) : (
              papers.map((paper) => (
                <PaperItem
                  key={paper.id}
                  paper={paper}
                  onClick={() => onSelectPaper(paper)}
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
