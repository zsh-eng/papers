import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchFiles, type FileSearchResult } from "@/lib/file-search";
import { invoke } from "@tauri-apps/api/core";
import { debounce } from "lodash-es";
import { useCallback, useEffect, useMemo, useState } from "react";

// Debounced search function - defined outside component
const debouncedSearchFiles = debounce(
  async (
    query: string,
    onSuccess: (results: FileSearchResult[]) => void,
    onError: (err: unknown) => void,
  ) => {
    try {
      const results = await searchFiles(query);
      onSuccess(results);
    } catch (err) {
      onError(err);
    }
  },
  50,
);

interface FileSearchPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FileSearchPalette({
  open,
  onOpenChange,
}: FileSearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FileSearchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Only search when query is non-empty
  useEffect(() => {
    if (!open) return;

    // Clear results immediately when query is empty
    if (query.trim() === "") {
      setResults([]);
      setSelectedId(null);
      return;
    }

    debouncedSearchFiles(
      query,
      (searchResults) => {
        setResults(searchResults);
      },
      (err) => {
        console.error("File search failed:", err);
        setResults([]);
      },
    );

    return () => debouncedSearchFiles.cancel();
  }, [query, open]);

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedId(null);
    }
  }, [open]);

  // Derive effective selected ID
  const effectiveSelectedId = useMemo(() => {
    if (results.length === 0) return null;
    if (selectedId && results.find((r) => r.path === selectedId)) {
      return selectedId;
    }
    return results[0].path;
  }, [results, selectedId]);

  // Get selected item
  const selectedItem = useMemo(() => {
    return results.find((r) => r.path === effectiveSelectedId) || null;
  }, [results, effectiveSelectedId]);

  const handleSelect = useCallback(
    async (result: FileSearchResult) => {
      // Extract filename for tab title
      const filename = result.path.split("/").pop() || result.display_path;
      const title = filename.replace(/\.md$/, "");

      // Always open in new tab (external files don't use SPA navigation)
      await invoke("create_tab", {
        tabType: "markdown",
        paperPath: result.path,
        title,
      });

      onOpenChange(false);
    },
    [onOpenChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (selectedItem) {
          handleSelect(selectedItem);
        }
      }
    },
    [selectedItem, handleSelect],
  );

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
      title="File Search"
      description="Search for markdown files in your home directory"
    >
      <Command
        shouldFilter={false}
        onKeyDown={handleKeyDown}
        value={effectiveSelectedId || undefined}
        onValueChange={handleValueChange}
      >
        <CommandInput
          placeholder="Search markdown files..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-80">
          <CommandEmpty>
            {query.trim() === "" ? "Type to search..." : "No files found."}
          </CommandEmpty>
          <CommandGroup>
            {results.map((result) => (
              <CommandItem
                key={result.path}
                value={result.path}
                onSelect={() => handleSelect(result)}
                className="flex flex-col items-start gap-0.5"
              >
                <span className="truncate w-full font-medium">
                  {result.path.split("/").pop()}
                </span>
                <span className="truncate w-full text-xs text-muted-foreground">
                  {result.display_path}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
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
