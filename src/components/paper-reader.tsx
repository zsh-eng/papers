import { useState, useEffect, useCallback, useRef } from "react";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { ArrowLeft, FileText, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
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
  const saveNotes = useCallback(async (notesContent: string) => {
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
  }, [paper.path]);

  // Handle notes change with debounced auto-save
  const handleNotesChange = useCallback((newNotes: string) => {
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
  }, [saveNotes]);

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

  const isLoading = isLoadingContent || isLoadingNotes;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="shrink-0"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="h-4 w-px bg-border shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <span className="font-medium text-sm truncate" title={paper.metadata.title}>
              {paper.metadata.title}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          {isSaving && (
            <span className="flex items-center gap-1">
              <Save className="w-3 h-3 animate-pulse" />
              Saving...
            </span>
          )}
          {lastSaved && !isSaving && (
            <span>
              Saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm border-b">
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
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground animate-pulse">Loading paper...</div>
        </div>
      ) : (
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          {/* Left panel - Markdown content */}
          <ResizablePanel defaultSize={60} minSize={30} id="content-panel">
            <div className="h-full overflow-auto">
              <MarkdownViewer content={content} className="p-6 max-w-none" />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right panel - Notes editor */}
          <ResizablePanel defaultSize={40} minSize={20} id="notes-panel">
            <div className="h-full flex flex-col border-l">
              <div className="px-4 py-2 border-b bg-muted/30 shrink-0">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Notes
                </span>
              </div>
              <NotesEditor
                value={notes}
                onChange={handleNotesChange}
                className="flex-1"
                placeholder="Start writing your notes..."
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}
