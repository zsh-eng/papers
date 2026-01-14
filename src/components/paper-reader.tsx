import { ArticleViewer } from "@/components/article-viewer";
import { NotesEditor } from "@/components/notes-editor";
import { PdfViewer } from "@/components/pdf-viewer";
import { ViewModeToggle, type ViewMode } from "@/components/view-mode-toggle";
import type { Paper } from "@/lib/papers";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { transformImageSources } from "@/lib/html";
import { useCallback, useEffect, useRef, useState } from "react";

interface PaperReaderProps {
  paper: Paper;
  onBack: () => void;
}

// Debounce delay for auto-save (ms)
const AUTO_SAVE_DELAY = 1500;

export function PaperReader({ paper, onBack }: PaperReaderProps) {
  const [html, setHtml] = useState<string>("");
  const [initialNotes, setInitialNotes] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("md");

  // Ref to track pending save timeout
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to track if notes have been modified
  const notesModifiedRef = useRef(false);
  // Ref to track current notes value (not state to avoid re-renders)
  const currentNotesRef = useRef<string>("");

  // Load content.html directly
  useEffect(() => {
    async function loadContent() {
      setIsLoadingContent(true);
      setError(null);
      try {
        const htmlContent = await readTextFile(paper.htmlPath);
        const transformedHtml = transformImageSources(htmlContent, paper.path);
        console.log(
          "Setting HTML, first img src:",
          transformedHtml.match(/src="([^"]+)"/)?.[1],
        );
        setHtml(transformedHtml);
      } catch (err) {
        console.error("Failed to load content:", err);
        setError(
          "Content not available. The paper may not have been fully processed.",
        );
      } finally {
        setIsLoadingContent(false);
      }
    }
    loadContent();
  }, [paper.htmlPath]);

  // Load notes.md
  useEffect(() => {
    async function loadNotes() {
      setIsLoadingNotes(true);
      try {
        const notesPath = `${paper.path}/notes.md`;
        const text = await readTextFile(notesPath);
        setInitialNotes(text);
        currentNotesRef.current = text;
      } catch {
        // Notes file might not exist yet
        const defaultNotes = `# Notes: ${paper.metadata.title}\n\n*Add your notes about this paper here.*\n`;
        setInitialNotes(defaultNotes);
        currentNotesRef.current = defaultNotes;
      } finally {
        setIsLoadingNotes(false);
      }
    }
    loadNotes();
  }, [paper.path, paper.metadata.title]);

  // Save notes to file
  const saveNotes = useCallback(
    async (notesContent: string) => {
      if (!notesModifiedRef.current) return;

      setIsSaving(true);
      try {
        const notesPath = `${paper.path}/notes.md`;
        await writeTextFile(notesPath, notesContent);
        setLastSaved(new Date());
        notesModifiedRef.current = false;
      } catch (err) {
        console.error("Failed to save notes:", err);
        setError("Failed to save notes");
      } finally {
        setIsSaving(false);
      }
    },
    [paper.path],
  );

  // Handle notes change with debounced auto-save
  const handleNotesChange = useCallback(
    (newNotes: string) => {
      currentNotesRef.current = newNotes;

      // Mark as modified if different from initial
      if (newNotes !== initialNotes) {
        notesModifiedRef.current = true;
      }

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout for auto-save
      saveTimeoutRef.current = setTimeout(() => {
        saveNotes(newNotes);
      }, AUTO_SAVE_DELAY);
    },
    [saveNotes, initialNotes],
  );

  // Cleanup timeout on unmount and save any pending changes
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Save on unmount if modified
      if (notesModifiedRef.current) {
        const notesPath = `${paper.path}/notes.md`;
        writeTextFile(notesPath, currentNotesRef.current).catch(console.error);
      }
    };
  }, [paper.path]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc to go back - only if nothing is focused (no active element with input/textarea/contenteditable)
      if (e.key === "Escape") {
        const activeElement = document.activeElement;
        const isInputFocused =
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement?.hasAttribute("contenteditable");

        // Don't handle Esc if an input element is focused or if any modal/dialog might be open
        if (!isInputFocused && activeElement === document.body) {
          onBack();
        }
      }

      // Cmd/Ctrl + B to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setNotesOpen((prev) => !prev);
      }

      // Cmd/Ctrl + Shift + P to toggle PDF/MD view
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "p") {
        e.preventDefault();
        setViewMode((prev) => (prev === "md" ? "pdf" : "md"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  const isLoading = isLoadingContent || isLoadingNotes;

  return (
    <div className="min-h-screen bg-background">
      <ViewModeToggle value={viewMode} onChange={setViewMode} />
      {/* Header bar with toggle and save status */}
      <div className="fixed top-[var(--titlebar-height)] left-0 right-0 z-20 flex items-center justify-between px-4 py-2">
        {/* Save status indicator */}
        <div className="text-xs text-muted-foreground/50">
          {isSaving
            ? "Saving..."
            : lastSaved
              ? `Saved ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : null}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="fixed top-0 left-0 right-0 z-30 px-4 py-2 bg-destructive/10 text-destructive text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main content */}
      {isLoading ? null : (
        <>
          {/* Article/PDF view with its own scroll container */}
          <div
            className="fixed top-[var(--titlebar-height)] bottom-0 left-0 overflow-auto"
            style={{
              right: notesOpen ? "40%" : 0,
              paddingTop: viewMode === "md" ? "3rem" : "0",
            }}
          >
            {viewMode === "md" ? (
              <ArticleViewer
                html={html}
                title={paper.metadata.title}
                authors={paper.metadata.authors}
                className="pb-32 px-6"
              />
            ) : (
              <PdfViewer pdfPath={paper.pdfPath} className="h-full" />
            )}
          </div>

          {/* Notes sidebar with its own scroll container */}
          {notesOpen && initialNotes !== null && (
            <div className="fixed top-[var(--titlebar-height)] right-0 bottom-0 w-[40%] border-l border-border bg-background z-10 flex flex-col">
              <NotesEditor
                value={initialNotes}
                onChange={handleNotesChange}
                className="flex-1 overflow-auto"
                placeholder="Start writing your notes..."
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
