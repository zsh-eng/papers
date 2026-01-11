import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OnboardingProps {
  onComplete: (path: string) => Promise<void>;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFolder = async () => {
    try {
      setIsSelecting(true);
      setError(null);

      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select your Papers workspace folder",
      });

      if (selected && typeof selected === "string") {
        await onComplete(selected);
      }
    } catch (err) {
      console.error("Failed to select folder:", err);
      setError(err instanceof Error ? err.message : "Failed to select folder");
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <FileText className="w-10 h-10 text-primary" />
          </div>
        </div>

        {/* Title and description */}
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Papers</h1>
          <p className="text-muted-foreground text-lg">
            Your research paper library. Read, annotate, and take notes on
            academic papers.
          </p>
        </div>

        {/* Description of what happens */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            Choose a folder to store your papers. A <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">papers/</code> directory will be created inside to organize your PDFs.
          </p>
        </div>

        {/* Select folder button */}
        <div className="pt-4">
          <Button
            size="lg"
            onClick={handleSelectFolder}
            disabled={isSelecting}
            className="w-full max-w-xs"
          >
            <FolderOpen className="w-5 h-5 mr-2" />
            {isSelecting ? "Selecting..." : "Select Folder"}
          </Button>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  );
}
