import { useCallback, useEffect, useMemo, useState } from "react";
import MiniSearch from "minisearch";
import { invoke } from "@tauri-apps/api/core";
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
import { FileTextIcon } from "lucide-react";

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
  const [papers, setPapers] = useState<PaperSearchItem[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Load all papers when workspace is ready
  useEffect(() => {
    if (!workspacePath || !open) return;

    setIsLoading(true);
    listAllPapers(workspacePath)
      .then(setPapers)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [workspacePath, open]);

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

    index.addAll(papers);
    return index;
  }, [papers]);

  // Get search results
  const results = useMemo(() => {
    if (!query.trim()) {
      // Show all papers when no query, sorted by year desc
      return papers.slice(0, 50);
    }

    const searchResults = searchIndex.search(query);
    return searchResults.map((result) => {
      // MiniSearch returns the stored fields directly
      return result as unknown as PaperSearchItem;
    });
  }, [query, searchIndex, papers]);

  const handleSelect = useCallback(
    async (item: PaperSearchItem, e?: React.MouseEvent | React.KeyboardEvent) => {
      const openInNewTab = e ? (e.metaKey || e.ctrlKey) : false;
      
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
    },
    [onSelectPaper, onOpenChange]
  );

  // Handle keyboard events for cmd+enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        // Find the currently selected item
        const selected = document.querySelector('[data-slot="command-item"][data-selected="true"]');
        if (selected) {
          const itemId = selected.getAttribute("data-value");
          const item = results.find((r) => r.id === itemId);
          if (item) {
            handleSelect(item, e);
          }
        }
      }
    },
    [results, handleSelect]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={(newOpen) => {
        onOpenChange(newOpen);
        if (!newOpen) setQuery("");
      }}
      title="Search Papers"
      description="Search for papers by title, author, or year"
    >
      <Command shouldFilter={false} onKeyDown={handleKeyDown}>
        <CommandInput
          placeholder="Search papers by title, author, or year..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading papers...
            </div>
          ) : (
            <>
              <CommandEmpty>No papers found.</CommandEmpty>
              <CommandGroup heading="Papers">
                {results.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => handleSelect(item)}
                    className="flex flex-col items-start gap-1 py-3"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium truncate flex-1">
                        {item.title}
                      </span>
                      {item.year && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {item.year}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 w-full pl-6 text-xs text-muted-foreground">
                      <span className="truncate">{item.authors}</span>
                      <span className="shrink-0 opacity-50">
                        {item.displayPath}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
        <div className="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Enter</kbd>
            {" "}to open
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Cmd</kbd>
            {" + "}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Enter</kbd>
            {" "}to open in new tab
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}
