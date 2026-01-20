import { ArticleViewer } from "@/components/article-viewer";
import { NotesEditor, type NotesEditorHandle } from "@/components/notes-editor";
import { PdfViewer } from "@/components/pdf-viewer";
import { ViewModeToggle, type ViewMode } from "@/components/view-mode-toggle";
import { useAnnotations } from "@/hooks/use-annotations";
import { useCommands } from "@/hooks/use-commands";
import { useNotes } from "@/hooks/use-notes";
import { usePaperHtmlQuery } from "@/hooks/use-paper-content";
import { useVisibilityRefetch } from "@/hooks/use-visibility-refetch";
import type { Paper } from "@/lib/papers";
import { queryKeys } from "@/lib/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface PaperReaderProps {
  paper: Paper;
  onBack: () => void;
}

export function PaperReader({ paper, onBack }: PaperReaderProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [dismissedHtmlError, setDismissedHtmlError] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("md");

  const queryClient = useQueryClient();
  const editorRef = useRef<NotesEditorHandle>(null);

  // Query hooks
  const {
    data: html,
    isLoading: isLoadingHtml,
    error: htmlError,
  } = usePaperHtmlQuery(paper);

  // Notes via custom hook with optimistic updates
  const {
    notes,
    isLoading: isLoadingNotes,
    updateNotes,
    hasPendingChanges,
  } = useNotes(paper.path, paper.metadata.title);

  // Annotations via React Query with optimistic updates
  const {
    annotations,
    isLoading: isLoadingAnnotations,
    createAnnotation: handleAnnotationCreate,
    deleteAnnotation: handleAnnotationDelete,
    updateAnnotation: handleAnnotationUpdate,
  } = useAnnotations(paper.path);

  // Derive error from query errors and action errors
  const error = useMemo(() => {
    if (actionError) return actionError;
    if (htmlError && !dismissedHtmlError) {
      return "Content not available. The paper may not have been fully processed.";
    }
    return null;
  }, [actionError, htmlError, dismissedHtmlError]);

  // Query key for notes - used by visibility refetch
  const notesQueryKey = useMemo(
    () => queryKeys.paperNotes(paper.path),
    [paper.path],
  );

  // Refetch notes on visibility regain (e.g., after editing externally)
  useVisibilityRefetch(
    useCallback(async () => {
      // Skip refresh if local unsaved changes exist (local wins)
      if (hasPendingChanges()) return;

      // Refetch from disk and refresh editor
      await queryClient.refetchQueries({ queryKey: notesQueryKey });
      const freshNotes = queryClient.getQueryData<string>(notesQueryKey);
      if (freshNotes !== undefined) {
        editorRef.current?.refresh(freshNotes);
      }
    }, [queryClient, notesQueryKey, hasPendingChanges]),
  );

  // Register reader-specific commands via the command registry
  useCommands(
    [
      {
        id: "reader.toggleSidebar",
        title: "Toggle Sidebar",
        shortcut: { key: "b", modifiers: ["cmd"] },
        execute: () => setNotesOpen((prev) => !prev),
      },
      {
        id: "reader.toggleViewMode",
        title: "Toggle PDF/Markdown View",
        shortcut: { key: "m", modifiers: ["cmd", "shift"] },
        execute: () => setViewMode((prev) => (prev === "md" ? "pdf" : "md")),
      },
    ],
    [setNotesOpen, setViewMode],
  );

  // Escape key to go back - kept separate since it's context-sensitive
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  const isLoading = isLoadingHtml || isLoadingNotes || isLoadingAnnotations;

  return (
    <div className="min-h-screen bg-background">
      <ViewModeToggle value={viewMode} onChange={setViewMode} />
      {/* Header bar with toggle and save status */}

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
                onAnnotationUpdate={handleAnnotationUpdate}
              />
            ) : (
              <PdfViewer pdfPath={paper.pdfPath} className="h-full" />
            )}
          </div>

          {/* Notes sidebar with its own scroll container */}
          {notes !== undefined && (
            <div
              className={`fixed top-0 right-0 bottom-0 w-[40%] border-l border-border bg-background z-10 flex flex-col ${!notesOpen ? "hidden" : ""}`}
            >
              <NotesEditor
                key={paper.path}
                ref={editorRef}
                value={notes}
                onChange={updateNotes}
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
