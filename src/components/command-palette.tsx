import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useWorkspace } from "@/hooks/use-workspace";
import { listAllPapers, type PaperSearchItem } from "@/lib/paper-search";
import type { Paper } from "@/lib/papers";
import { invoke } from "@tauri-apps/api/core";
import MiniSearch from "minisearch";
import { useCallback, useEffect, useMemo, useState } from "react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPaper: (paper: Paper, openInNewTab: boolean) => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onSelectPaper,
}: CommandPaletteProps) {
  const { workspacePath } = useWorkspace();
  // null = not yet loaded for current workspace, empty array = loaded but empty
  const [papers, setPapers] = useState<PaperSearchItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Track which workspace we last loaded for
  const [loadedWorkspace, setLoadedWorkspace] = useState<string | null>(null);

  // Determine if we need to load: workspace changed or papers not yet loaded
  const needsLoad = workspacePath && open && workspacePath !== loadedWorkspace;
  const isLoading = needsLoad || papers === null;

  // Load all papers when workspace is ready
  useEffect(() => {
    if (!workspacePath || !open) return;
    // Skip if already loaded for this workspace
    if (workspacePath === loadedWorkspace && papers !== null) return;

    let isCancelled = false;

    listAllPapers(workspacePath)
      .then((loadedPapers) => {
        if (!isCancelled) {
          setPapers(loadedPapers);
          setLoadedWorkspace(workspacePath);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!isCancelled) {
          setPapers([]); // Set to empty on error so we don't keep retrying
          setLoadedWorkspace(workspacePath);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [workspacePath, open, loadedWorkspace, papers]);

  // Build MiniSearch index
  const searchIndex = useMemo(() => {
    const index = new MiniSearch<PaperSearchItem>({
      fields: ["title", "authors", "year"],
      storeFields: ["id", "title", "authors", "year", "displayPath", "paper"],
      searchOptions: {
        boost: { title: 2, authors: 1.5, year: 1 },
        fuzzy: 0.2,
        prefix: true,
      },
    });

    index.addAll(papers ?? []);
    return index;
  }, [papers]);

  // Get search results
  const results = useMemo(() => {
    const paperList = papers ?? [];
    if (!query.trim()) {
      // Show all papers when no query, sorted by year desc
      return paperList.slice(0, 50);
    }

    const searchResults = searchIndex.search(query);
    return searchResults.map((result) => {
      // MiniSearch returns the stored fields directly
      return result as unknown as PaperSearchItem;
    });
  }, [query, searchIndex, papers]);

  // Derive effective selected ID - auto-select first result if current selection is invalid
  const effectiveSelectedId = useMemo(() => {
    if (results.length === 0) return null;
    if (selectedId && results.find((r) => r.id === selectedId)) {
      return selectedId;
    }
    return results[0].id;
  }, [results, selectedId]);

  // Get the currently selected item for preview
  const selectedItem = useMemo(() => {
    return results.find((r) => r.id === effectiveSelectedId) || null;
  }, [results, effectiveSelectedId]);

  const handleSelect = useCallback(
    async (
      item: PaperSearchItem,
      e?: React.MouseEvent | React.KeyboardEvent,
    ) => {
      const openInNewTab = e ? e.metaKey || e.ctrlKey : false;

      if (openInNewTab) {
        // Open in new tab via Rust
        const title = item.paper.metadata.title || item.paper.id;
        await invoke("create_tab", {
          tabType: "paper",
          paperPath: item.paper.path,
          title,
        });
      } else {
        // Navigate in current tab
        onSelectPaper(item.paper, false);
      }

      onOpenChange(false);
      setQuery("");
      setSelectedId(null);
    },
    [onSelectPaper, onOpenChange],
  );

  // Handle keyboard events for cmd+enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        if (selectedItem) {
          handleSelect(selectedItem, e);
        }
      }
    },
    [selectedItem, handleSelect],
  );

  // Track selection changes from cmdk
  const handleValueChange = useCallback((value: string) => {
    setSelectedId(value);
  }, []);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(newOpen) => {
        onOpenChange(newOpen);
        if (!newOpen) {
          setQuery("");
          setSelectedId(null);
        }
      }}
      title="Search Papers"
      description="Search for papers by title, author, or year"
    >
      <Command
        shouldFilter={false}
        onKeyDown={handleKeyDown}
        value={effectiveSelectedId || undefined}
        onValueChange={handleValueChange}
      >
        <CommandInput
          placeholder="Search papers..."
          value={query}
          onValueChange={setQuery}
        />
        <div className="flex min-h-100">
          {/* Left panel - results list */}
          <div className="w-1/2 border-r border-border/50">
            <CommandList className="max-h-100 h-full">
              {isLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Loading papers...
                </div>
              ) : (
                <>
                  <CommandEmpty>No papers found.</CommandEmpty>
                  <CommandGroup>
                    {results.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.id}
                        onSelect={() => handleSelect(item)}
                      >
                        <span className="truncate">{item.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </div>

          {/* Right panel - preview */}
          <div className="w-1/2 p-4 bg-muted/30">
            {selectedItem ? (
              <div className="space-y-4">
                <h3 className="font-medium text-sm leading-tight">
                  {selectedItem.title}
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Authors</span>
                    <span className="text-right max-w-[60%] text-wrap line-clamp-3 text-ellipsis">
                      {selectedItem.authors || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Year</span>
                    <span>{selectedItem.year || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location</span>
                    <span className="text-right max-w-[60%] truncate">
                      {selectedItem.displayPath}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No paper selected
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
              Enter
            </kbd>{" "}
            to open
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
              Cmd
            </kbd>
            {" + "}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
              Enter
            </kbd>{" "}
            new tab
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}
