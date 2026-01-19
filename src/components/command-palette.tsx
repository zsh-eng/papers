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
import {
  listAllItems,
  type MarkdownSearchItem,
  type PaperSearchItem,
  type SearchItem,
} from "@/lib/paper-search";
import type { MarkdownFile, Paper } from "@/lib/papers";
import { invoke } from "@tauri-apps/api/core";
import MiniSearch from "minisearch";
import { useCallback, useEffect, useMemo, useState } from "react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPaper: (paper: Paper, openInNewTab: boolean) => void;
  onSelectMarkdown: (markdown: MarkdownFile, openInNewTab: boolean) => void;
}

interface LoadedItems {
  papers: PaperSearchItem[];
  markdowns: MarkdownSearchItem[];
}

export function CommandPalette({
  open,
  onOpenChange,
  onSelectPaper,
  onSelectMarkdown,
}: CommandPaletteProps) {
  const { workspacePath } = useWorkspace();
  // null = not yet loaded for current workspace
  const [items, setItems] = useState<LoadedItems | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Track which workspace we last loaded for
  const [loadedWorkspace, setLoadedWorkspace] = useState<string | null>(null);

  // Determine if we need to load: workspace changed or items not yet loaded
  const needsLoad = workspacePath && open && workspacePath !== loadedWorkspace;
  const isLoading = needsLoad || items === null;

  // Load all items when workspace is ready
  useEffect(() => {
    if (!workspacePath || !open) return;
    // Skip if already loaded for this workspace
    if (workspacePath === loadedWorkspace && items !== null) return;

    let isCancelled = false;

    listAllItems(workspacePath)
      .then((loadedItems) => {
        if (!isCancelled) {
          setItems(loadedItems);
          setLoadedWorkspace(workspacePath);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!isCancelled) {
          // Set to empty on error so we don't keep retrying
          setItems({ papers: [], markdowns: [] });
          setLoadedWorkspace(workspacePath);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [workspacePath, open, loadedWorkspace, items]);

  // Combine papers and markdowns into a single list for display
  // Papers first (sorted by year desc), then markdowns (sorted by modified date desc)
  const allItems = useMemo((): SearchItem[] => {
    if (!items) return [];
    return [...items.papers, ...items.markdowns];
  }, [items]);

  // Build MiniSearch index for combined items
  const searchIndex = useMemo(() => {
    const index = new MiniSearch<SearchItem>({
      fields: ["title", "authors", "author", "year"],
      storeFields: [
        "type",
        "id",
        "title",
        "authors",
        "author",
        "year",
        "displayPath",
        "paper",
        "markdown",
        "modifiedAt",
      ],
      searchOptions: {
        boost: { title: 2, authors: 1.5, author: 1.5, year: 1 },
        fuzzy: 0.2,
        prefix: true,
      },
    });

    index.addAll(allItems);
    return index;
  }, [allItems]);

  // Get search results
  const results = useMemo((): SearchItem[] => {
    if (!query.trim()) {
      // Show all items when no query (already sorted)
      return allItems.slice(0, 50);
    }

    const searchResults = searchIndex.search(query);
    return searchResults.map((result) => {
      // MiniSearch returns the stored fields directly
      return result as unknown as SearchItem;
    });
  }, [query, searchIndex, allItems]);

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
    async (item: SearchItem, e?: React.MouseEvent | React.KeyboardEvent) => {
      const openInNewTab = e ? e.metaKey || e.ctrlKey : false;

      if (item.type === "paper") {
        if (openInNewTab) {
          // Open paper in new tab via Rust
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
      } else {
        // Markdown
        if (openInNewTab) {
          // Open markdown in new tab via Rust
          const title = item.markdown.metadata.title || item.markdown.id;
          await invoke("create_tab", {
            tabType: "markdown",
            paperPath: item.markdown.path,
            title,
          });
        } else {
          // Navigate in current tab
          onSelectMarkdown(item.markdown, false);
        }
      }

      onOpenChange(false);
      setQuery("");
      setSelectedId(null);
    },
    [onSelectPaper, onSelectMarkdown, onOpenChange],
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

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

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
      title="Search"
      description="Search for papers and notes by title, author, or year"
    >
      <Command
        shouldFilter={false}
        onKeyDown={handleKeyDown}
        value={effectiveSelectedId || undefined}
        onValueChange={handleValueChange}
      >
        <CommandInput
          placeholder="Search papers and notes..."
          value={query}
          onValueChange={setQuery}
        />
        <div className="flex min-h-100">
          {/* Left panel - results list */}
          <div className="w-1/2 border-r border-border/50">
            <CommandList className="max-h-100 h-full">
              {isLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : (
                <>
                  <CommandEmpty>No results found.</CommandEmpty>
                  <CommandGroup>
                    {results.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.id}
                        onSelect={() => handleSelect(item)}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate flex-1">{item.title}</span>
                        {item.type === "markdown" && (
                          <span className="text-xs font-medium text-muted-foreground shrink-0">
                            MD
                          </span>
                        )}
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
                  {selectedItem.type === "paper" ? (
                    // Paper preview
                    <>
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
                    </>
                  ) : (
                    // Markdown preview
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Author</span>
                        <span className="text-right max-w-[60%] truncate">
                          {selectedItem.author || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Modified</span>
                        <span>{formatDate(selectedItem.modifiedAt)}</span>
                      </div>
                    </>
                  )}
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
                No item selected
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
