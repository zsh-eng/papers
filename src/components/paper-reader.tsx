import { useState, useEffect, useCallback, useRef } from "react";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { NotesEditor } from "@/components/notes-editor";
import type { Paper } from "@/lib/papers";

interface PaperReaderProps {
  paper: Paper;
  onBack: () => void;
}

// Debounce delay for auto-save (ms)
const AUTO_SAVE_DELAY = 1500;

export function PaperReader({ paper, onBack }: PaperReaderProps) {
  const [content, setContent] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  // Ref to track pending save timeout
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to track if notes have been modified
  const notesModifiedRef = useRef(false);
  // Ref to track initial notes value for comparison
  const initialNotesRef = useRef<string>("");

  // Load content.md
  useEffect(() => {
    async function loadContent() {
      setIsLoadingContent(true);
      try {
        const text = await readTextFile(paper.contentPath);
        setContent(text);
      } catch (err) {
        console.error("Failed to load content:", err);
        setError("Failed to load paper content");
      } finally {
        setIsLoadingContent(false);
      }
    }
    loadContent();
  }, [paper.contentPath]);

  // Load notes.md
  useEffect(() => {
    async function loadNotes() {
      setIsLoadingNotes(true);
      try {
        const notesPath = `${paper.path}/notes.md`;
        const text = await readTextFile(notesPath);
        setNotes(text);
        initialNotesRef.current = text;
      } catch (err) {
        // Notes file might not exist yet
        console.warn("Notes file not found, starting with empty:", err);
        const defaultNotes = `# Notes: ${paper.metadata.title}\n\n*Add your notes about this paper here.*\n`;
        setNotes(defaultNotes);
        initialNotesRef.current = defaultNotes;
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
        initialNotesRef.current = notesContent;
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
      setNotes(newNotes);

      // Mark as modified if different from initial
      if (newNotes !== initialNotesRef.current) {
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
    [saveNotes],
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
        writeTextFile(notesPath, notes).catch(console.error);
      }
    };
  }, [paper.path, notes]);

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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  const isLoading = isLoadingContent || isLoadingNotes;

  return (
    <div className="min-h-screen bg-background">
      {/* Save status indicator - subtle */}
      {(isSaving || lastSaved) && (
        <div className="fixed top-[calc(var(--titlebar-height)+0.5rem)] right-6 z-20 text-xs text-muted-foreground/50 py-2">
          {isSaving
            ? "Saving..."
            : lastSaved
              ? `Saved ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : null}
        </div>
      )}

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
      {isLoading ? // <div className="h-screen flex items-center justify-center">
      //   <div className="text-muted-foreground animate-pulse">Loading paper...</div>
      // </div>
      null : (
        <>
          {/* Main scrollable paper content */}
          <div
            className={`paper-scroll-container ${notesOpen ? "with-notes" : ""}`}
            style={notesOpen ? { marginRight: "40%" } : undefined}
          >
            <MarkdownViewer content={content} className="pb-32 px-6" />
          </div>

          {/* Fixed notes sidebar - starts below titlebar */}
          {notesOpen && (
            <div className="fixed top-0 right-0 bottom-0 w-[40%] border-l border-border bg-background z-10 flex flex-col pt-[var(--titlebar-height)]">
              <NotesEditor
                value={notes}
                onChange={handleNotesChange}
                className="flex-1 overflow-hidden"
                placeholder="Start writing your notes..."
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
