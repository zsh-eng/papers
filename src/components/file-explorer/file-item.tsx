import { File, Folder, Trash2 } from "lucide-react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FileEntry } from "@/lib/fs";

interface FileItemProps {
  entry: FileEntry;
  onNavigate: (path: string) => void;
  onDelete: (path: string) => void;
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return "-";
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(date?: Date): string {
  if (!date) return "-";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function FileItem({ entry, onNavigate, onDelete }: FileItemProps) {
  const handleDoubleClick = () => {
    if (entry.isDirectory) {
      onNavigate(entry.path);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm(
      `Are you sure you want to delete "${entry.name}"?${entry.isDirectory ? " This will delete all contents." : ""}`,
      { title: "Confirm Delete", kind: "warning" }
    );
    if (confirmed) {
      onDelete(entry.path);
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 hover:bg-accent rounded-md cursor-default group"
      onDoubleClick={handleDoubleClick}
    >
      {entry.isDirectory ? (
        <Folder className="h-5 w-5 text-blue-500 flex-shrink-0" />
      ) : (
        <File className="h-5 w-5 text-gray-500 flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <span className="truncate block">{entry.name}</span>
      </div>

      <Badge variant="secondary" className="flex-shrink-0">
        {entry.isDirectory ? "Folder" : "File"}
      </Badge>

      <span className="text-sm text-muted-foreground w-20 text-right flex-shrink-0">
        {entry.isFile ? formatSize(entry.size) : "-"}
      </span>

      <span className="text-sm text-muted-foreground w-28 text-right flex-shrink-0">
        {formatDate(entry.modifiedAt)}
      </span>

      <Button
        variant="ghost"
        size="sm"
        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={handleDelete}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
