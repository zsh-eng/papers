import { cn } from "@/lib/utils";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { FileUp } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

interface DropZoneProps {
  onDrop: (paths: string[]) => void;
  accept?: string[];
  children?: ReactNode;
  className?: string;
}

export function DropZone({
  onDrop,
  accept = [".pdf"],
  children,
  className,
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const webview = getCurrentWebview();

    const setupListener = async () => {
      const unlisten = await webview.onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setIsDragOver(true);
        } else if (event.payload.type === "drop") {
          setIsDragOver(false);

          // Filter by accepted file extensions
          const paths = event.payload.paths.filter((path) => {
            const ext = `.${path.split(".").pop()?.toLowerCase()}`;
            return accept.some((a) => a.toLowerCase() === ext);
          });

          if (paths.length > 0) {
            onDrop(paths);
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
  }, [accept, onDrop]);

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 border-dashed transition-colors",
        isDragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50",
        className,
      )}
    >
      {children || (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors",
              isDragOver ? "bg-primary/10" : "bg-muted",
            )}
          >
            <FileUp
              className={cn(
                "w-6 h-6 transition-colors",
                isDragOver ? "text-primary" : "text-muted-foreground",
              )}
            />
          </div>
          <p className="text-sm font-medium text-foreground">
            {isDragOver ? "Drop your PDFs here" : "Drag and drop PDFs here"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">PDF files only</p>
        </div>
      )}
    </div>
  );
}
