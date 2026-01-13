import { useState, useEffect, useCallback, useRef } from "react";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { ArticleViewer } from "@/components/article-viewer";
import { NotesEditor } from "@/components/notes-editor";
import {
  renderMarkdownBodyCached,
  parseFrontmatter,
  type ParsedFrontmatter,
} from "@/lib/markdown";
import type { Paper } from "@/lib/papers";

interface PaperReaderProps {
  paper: Paper;
  onBack: () => void;
}

// Debounce delay for auto-save (ms)
const AUTO_SAVE_DELAY = 1500;

export function PaperReader({ paper, onBack }: PaperReaderProps) {
  const [html, setHtml] = useState<string>("");
  const [frontmatter, setFrontmatter] = useState<ParsedFrontmatter>({});
  const [initialNotes, setInitialNotes] = useState<string | null>(null);
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
  // Ref to track current notes value (not state to avoid re-renders)
  const currentNotesRef = useRef<string>("");

  // Load and render content.md
  useEffect(() => {
    async function loadAndRenderContent() {
      setIsLoadingContent(true);
      try {
        // Read the markdown file
        console.time("readTextFile");
        const markdown = await readTextFile(paper.contentPath);
        console.timeEnd("readTextFile");

        // Parse frontmatter (synchronous, fast)
        const fm = parseFrontmatter(markdown);
        setFrontmatter(fm);

        // Render markdown to HTML (with caching)
        const result = await renderMarkdownBodyCached(
          markdown,
          paper.contentPath
        );
        setHtml(result.html);

        // Log performance info
        if (result.fromCache) {
          console.debug("[PaperReader] Cache HIT");
        } else {
          console.debug(
            `[PaperReader] Cache MISS - rendered in ${result.renderTimeMs?.toFixed(2)}ms`
          );
        }
      } catch (err) {
        console.error("Failed to load content:", err);
        setError("Failed to load paper content");
      } finally {
        setIsLoadingContent(false);
      }
    }
    loadAndRenderContent();
  }, [paper.contentPath]);

  // Load notes.md
  useEffect(() => {
    async function loadNotes() {
      setIsLoadingNotes(true);
      try {
        const notesPath = `${paper.path}/notes.md`;
        const text = await readTextFile(notesPath);
        setInitialNotes(text);
        currentNotesRef.current = text;
      } catch (err) {
        // Notes file might not exist yet
        console.warn("Notes file not found, starting with empty:", err);
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
    [paper.path]
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
    [saveNotes, initialNotes]
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
      {isLoading ? null : (
        <>
          {/* Main scrollable paper content */}
          <div
            className={`paper-scroll-container ${notesOpen ? "with-notes" : ""}`}
            style={notesOpen ? { marginRight: "40%" } : undefined}
          >
            <ArticleViewer
              html={html}
              title={frontmatter.title}
              authors={frontmatter.authors}
              className="pb-32 px-6"
            />
          </div>

          {/* Fixed notes sidebar - starts below titlebar */}
          {notesOpen && initialNotes !== null && (
            <div className="fixed top-0 right-0 bottom-0 w-[40%] border-l border-border bg-background z-10 flex flex-col pt-[var(--titlebar-height)]">
              <NotesEditor
                value={initialNotes}
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
