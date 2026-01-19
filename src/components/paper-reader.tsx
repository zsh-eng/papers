import { ArticleViewer } from "@/components/article-viewer";
import { NotesEditor } from "@/components/notes-editor";
import { PdfViewer } from "@/components/pdf-viewer";
import { ViewModeToggle, type ViewMode } from "@/components/view-mode-toggle";
import {
  useAnnotationsQuery,
  useSaveAnnotationsMutation,
} from "@/hooks/use-annotations";
import {
  usePaperHtmlQuery,
  usePaperNotesQuery,
  useSaveNotesMutation,
} from "@/hooks/use-paper-content";
import {
  generateAnnotationId,
  saveAnnotations,
  type Annotation,
  type AnnotationColor,
  type TextPosition,
} from "@/lib/annotations";
import type { Paper } from "@/lib/papers";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface PaperReaderProps {
  paper: Paper;
  onBack: () => void;
}

// Debounce delay for auto-save (ms)
const AUTO_SAVE_DELAY = 1500;

export function PaperReader({ paper, onBack }: PaperReaderProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dismissedHtmlError, setDismissedHtmlError] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("md");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // Query hooks
  const {
    data: html,
    isLoading: isLoadingHtml,
    error: htmlError,
  } = usePaperHtmlQuery(paper);
  const { data: initialNotes, isLoading: isLoadingNotes } = usePaperNotesQuery(
    paper.path,
    paper.metadata.title,
  );
  const { data: loadedAnnotations, isLoading: isLoadingAnnotations } =
    useAnnotationsQuery(paper.path);

  // Derive error from query errors and action errors
  const error = useMemo(() => {
    if (actionError) return actionError;
    if (htmlError && !dismissedHtmlError) {
      return "Content not available. The paper may not have been fully processed.";
    }
    return null;
  }, [actionError, htmlError, dismissedHtmlError]);

  // Mutation hooks
  const saveNotesMutation = useSaveNotesMutation();
  const saveAnnotationsMutation = useSaveAnnotationsMutation();

  // Ref to track pending save timeout
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to track if notes have been modified
  const notesModifiedRef = useRef(false);
  // Ref to track current notes value (not state to avoid re-renders)
  const currentNotesRef = useRef<string>("");
  // Ref to track pending annotation save timeout
  const annotationSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Ref to track if annotations have been modified
  const annotationsModifiedRef = useRef(false);
  // Ref to track current annotations value
  const currentAnnotationsRef = useRef<Annotation[]>([]);

  // Sync loaded annotations to local state
  useEffect(() => {
    if (loadedAnnotations) {
      setAnnotations(loadedAnnotations);
      currentAnnotationsRef.current = loadedAnnotations;
    }
  }, [loadedAnnotations]);

  // Sync initial notes to ref
  useEffect(() => {
    if (initialNotes) {
      currentNotesRef.current = initialNotes;
    }
  }, [initialNotes]);

  // Save notes to file
  const saveNotes = useCallback(
    async (notesContent: string) => {
      if (!notesModifiedRef.current) return;

      setIsSaving(true);
      try {
        await saveNotesMutation.mutateAsync({
          paperPath: paper.path,
          content: notesContent,
        });
        setLastSaved(new Date());
        notesModifiedRef.current = false;
      } catch (err) {
        console.error("Failed to save notes:", err);
        setActionError("Failed to save notes");
      } finally {
        setIsSaving(false);
      }
    },
    [paper.path, saveNotesMutation],
  );

  // Save annotations to file
  const saveAnnotationsToFile = useCallback(
    async (annotationsToSave: Annotation[]) => {
      if (!annotationsModifiedRef.current) return;

      setIsSaving(true);
      try {
        await saveAnnotationsMutation.mutateAsync({
          paperPath: paper.path,
          annotations: annotationsToSave,
        });
        setLastSaved(new Date());
        annotationsModifiedRef.current = false;
      } catch (err) {
        console.error("Failed to save annotations:", err);
        setActionError("Failed to save annotations");
      } finally {
        setIsSaving(false);
      }
    },
    [paper.path, saveAnnotationsMutation],
  );

  // Handle creating a new annotation
  const handleAnnotationCreate = useCallback(
    (position: TextPosition, color: AnnotationColor) => {
      const now = new Date().toISOString();
      const newAnnotation: Annotation = {
        id: generateAnnotationId(),
        source: "html",
        color,
        createdAt: now,
        updatedAt: now,
        position,
      };

      const updatedAnnotations = [
        ...currentAnnotationsRef.current,
        newAnnotation,
      ];
      setAnnotations(updatedAnnotations);
      currentAnnotationsRef.current = updatedAnnotations;
      annotationsModifiedRef.current = true;

      // Clear existing timeout and set new one for auto-save
      if (annotationSaveTimeoutRef.current) {
        clearTimeout(annotationSaveTimeoutRef.current);
      }
      annotationSaveTimeoutRef.current = setTimeout(() => {
        saveAnnotationsToFile(updatedAnnotations);
      }, AUTO_SAVE_DELAY);
    },
    [saveAnnotationsToFile],
  );

  // Handle deleting an annotation
  const handleAnnotationDelete = useCallback(
    (id: string) => {
      const updatedAnnotations = currentAnnotationsRef.current.filter(
        (ann) => ann.id !== id,
      );
      setAnnotations(updatedAnnotations);
      currentAnnotationsRef.current = updatedAnnotations;
      annotationsModifiedRef.current = true;

      // Clear existing timeout and set new one for auto-save
      if (annotationSaveTimeoutRef.current) {
        clearTimeout(annotationSaveTimeoutRef.current);
      }
      annotationSaveTimeoutRef.current = setTimeout(() => {
        saveAnnotationsToFile(updatedAnnotations);
      }, AUTO_SAVE_DELAY);
    },
    [saveAnnotationsToFile],
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
      if (annotationSaveTimeoutRef.current) {
        clearTimeout(annotationSaveTimeoutRef.current);
      }
      // Save on unmount if modified (using direct writes for unmount to avoid async issues)
      if (notesModifiedRef.current) {
        const notesPath = `${paper.path}/notes.md`;
        writeTextFile(notesPath, currentNotesRef.current).catch(console.error);
      }
      if (annotationsModifiedRef.current) {
        saveAnnotations(paper.path, currentAnnotationsRef.current).catch(
          console.error,
        );
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

  const isLoading = isLoadingHtml || isLoadingNotes || isLoadingAnnotations;

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
            onClick={() => {
              setActionError(null);
              setDismissedHtmlError(true);
            }}
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
            className="fixed top-0 bottom-0 left-0 overflow-auto"
            style={{
              right: notesOpen ? "40%" : 0,
              paddingTop: viewMode === "md" ? "3rem" : "0",
            }}
          >
            {viewMode === "md" ? (
              <ArticleViewer
                html={html || ""}
                title={paper.metadata.title}
                authors={paper.metadata.authors}
                className="pb-32 px-6 paper-scroll-container"
                annotations={annotations}
                onAnnotationCreate={handleAnnotationCreate}
                onAnnotationDelete={handleAnnotationDelete}
              />
            ) : (
              <PdfViewer pdfPath={paper.pdfPath} className="h-full" />
            )}
          </div>

          {/* Notes sidebar with its own scroll container */}
          {initialNotes !== undefined && (
            <div
              className={`fixed top-0 right-0 bottom-0 w-[40%] border-l border-border bg-background z-10 flex flex-col ${!notesOpen ? "hidden" : ""}`}
            >
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
