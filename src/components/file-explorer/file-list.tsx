import { Loader2, FolderOpen } from "lucide-react";
import { FileItem } from "./file-item";
import type { FileEntry } from "@/lib/fs";

interface FileListProps {
  entries: FileEntry[];
  loading: boolean;
  error: string | null;
  hasRoot: boolean;
  onNavigate: (path: string) => void;
  onDelete: (path: string) => void;
}

export function FileList({
  entries,
  loading,
  error,
  hasRoot,
  onNavigate,
  onDelete,
}: FileListProps) {
  if (!hasRoot) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <FolderOpen className="h-12 w-12 mb-4" />
        <p>Select a folder to browse</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive">
        <p className="font-medium">Error loading directory</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <FolderOpen className="h-12 w-12 mb-4" />
        <p>This folder is empty</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-2">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-1 text-xs font-medium text-muted-foreground border-b mb-1">
        <div className="w-5" /> {/* Icon space */}
        <div className="flex-1">Name</div>
        <div className="w-16">Type</div>
        <div className="w-20 text-right">Size</div>
        <div className="w-28 text-right">Modified</div>
        <div className="w-8" /> {/* Actions space */}
      </div>

      {/* Items */}
      {entries.map((entry) => (
        <FileItem
          key={entry.path}
          entry={entry}
          onNavigate={onNavigate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
