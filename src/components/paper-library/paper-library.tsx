import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { usePaperLibrary } from "@/hooks/use-paper-library";
import type { MarkdownFile, Paper } from "@/lib/papers";
import { useEffect, useState } from "react";
import { LibraryBreadcrumb } from "./library-breadcrumb";
import { CreateFolderDialog, DeleteConfirmDialog } from "./library-dialogs";
import { FolderRow, MarkdownRow, PaperRow } from "./library-rows";

interface PaperLibraryProps {
  workspacePath: string;
  onSelectPaper: (paper: Paper, openInNewTab: boolean) => void;
  onSelectMarkdown: (markdown: MarkdownFile, openInNewTab: boolean) => void;
}

export function PaperLibrary({
  workspacePath,
  onSelectPaper,
  onSelectMarkdown,
}: PaperLibraryProps) {
  const {
    currentPath,
    items,
    isLoading,
    error,
    breadcrumbs,
    navigateTo,
    createNewFolder,
    deleteLibraryItem,
    refresh,
  } = usePaperLibrary(workspacePath);

  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const { isDark, toggle } = useDarkMode();

  // Dialog states
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    path: string;
    name: string;
  } | null>(null);

  // Initial load
  useEffect(() => {
    if (currentPath) {
      refresh();
    }
  }, [currentPath, refresh]);

  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    if (itemToDelete) {
      deleteLibraryItem(itemToDelete.path);
      setItemToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  // Get unique ID for an item (for hover state)
  const getItemId = (item: (typeof items)[0]): string => {
    if (item.type === "folder") {
      return `folder:${item.path}`;
    } else if (item.type === "paper") {
      return `paper:${item.paper.id}`;
    } else {
      return `markdown:${item.markdown.id}`;
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger className="h-screen flex flex-col">
        {/* Main content - centered */}
        <main className="flex-1 overflow-auto pt-[calc(var(--titlebar-height)+3rem)]">
          <div className="max-w-4xl mx-auto px-8">
            {/* Header with breadcrumbs */}
            <div className="flex items-center gap-3 font-mono text-base tracking-widest text-foreground mb-8 pb-4 border-b border-border">
              <span className="text-foreground text-lg">■</span>
              <LibraryBreadcrumb
                breadcrumbs={breadcrumbs}
                onNavigate={navigateTo}
              />
              <button
                onClick={toggle}
                className="ml-auto text-sm hover:text-muted-foreground transition-colors"
                aria-label={
                  isDark ? "Switch to light mode" : "Switch to dark mode"
                }
                data-no-drag
              >
                {isDark ? "☀" : "☾"}
              </button>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-6 text-sm text-destructive">{error}</div>
            )}

            {/* Items list */}
            <div onMouseLeave={() => setHoveredItemId(null)}>
              {items.length === 0 && !isLoading ? (
                <div className="text-muted-foreground py-8">
                  <p className="text-sm">This folder is empty</p>
                  <p className="text-xs mt-1 text-muted-foreground/60">
                    Drop PDFs to add papers, or right-click to create a folder
                  </p>
                </div>
              ) : (
                items.map((item) => {
                  const itemId = getItemId(item);
                  if (item.type === "folder") {
                    return (
                      <ContextMenu key={itemId}>
                        <ContextMenuTrigger>
                          <FolderRow
                            folder={item}
                            onClick={() => navigateTo(item.path)}
                            onContextMenu={() => {}}
                            isHovered={hoveredItemId === itemId}
                            isAnyHovered={hoveredItemId !== null}
                            onHover={() => setHoveredItemId(itemId)}
                          />
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={() => {
                              setItemToDelete({
                                path: item.path,
                                name: item.name,
                              });
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            Delete Folder
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  } else if (item.type === "paper") {
                    return (
                      <ContextMenu key={itemId}>
                        <ContextMenuTrigger>
                          <PaperRow
                            paper={item.paper}
                            onClick={(openInNewTab) =>
                              onSelectPaper(item.paper, openInNewTab)
                            }
                            onContextMenu={() => {}}
                            isHovered={hoveredItemId === itemId}
                            isAnyHovered={hoveredItemId !== null}
                            onHover={() => setHoveredItemId(itemId)}
                          />
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={() => {
                              setItemToDelete({
                                path: item.paper.path,
                                name:
                                  item.paper.metadata.title || item.paper.id,
                              });
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            Delete Paper
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  } else {
                    // Markdown file
                    return (
                      <ContextMenu key={itemId}>
                        <ContextMenuTrigger>
                          <MarkdownRow
                            markdown={item.markdown}
                            onClick={(openInNewTab) =>
                              onSelectMarkdown(item.markdown, openInNewTab)
                            }
                            onContextMenu={() => {}}
                            isHovered={hoveredItemId === itemId}
                            isAnyHovered={hoveredItemId !== null}
                            onHover={() => setHoveredItemId(itemId)}
                          />
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={() => {
                              setItemToDelete({
                                path: item.markdown.path,
                                name: item.markdown.metadata.title,
                              });
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            Delete Markdown
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  }
                })
              )}
            </div>
          </div>
        </main>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => setCreateFolderOpen(true)}>
          New Folder
        </ContextMenuItem>
      </ContextMenuContent>

      {/* Create folder dialog */}
      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        onCreate={createNewFolder}
      />

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemName={itemToDelete?.name || ""}
        onConfirm={handleDeleteConfirm}
      />
    </ContextMenu>
  );
}
