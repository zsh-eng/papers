import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { usePaperLibrary, type Breadcrumb } from "@/hooks/use-paper-library";
import type { LibraryFolder, Paper } from "@/lib/papers";
import { cn } from "@/lib/utils";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useState } from "react";

interface PaperLibraryProps {
  workspacePath: string;
  onSelectPaper: (paper: Paper, openInNewTab: boolean) => void;
}

// ============================================================================
// Breadcrumb Component
// ============================================================================

function LibraryBreadcrumb({
  breadcrumbs,
  onNavigate,
}: {
  breadcrumbs: Breadcrumb[];
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 font-mono text-base tracking-widest">
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const isFirst = index === 0;
        return (
          <span key={crumb.path} className="flex items-center gap-1">
            {index > 0 && (
              <span className="text-muted-foreground/60 mx-1">/</span>
            )}
            {/* The first "PAPERS" should be uppercase, this is a hacky fix for now */}
            {isLast ? (
              <span className={cn("text-foreground", isFirst && "uppercase")}>
                {crumb.name}
              </span>
            ) : (
              <button
                onClick={() => onNavigate(crumb.path)}
                className={cn(
                  "text-muted-foreground hover:text-foreground transition-colors",
                  isFirst && "uppercase",
                )}
                data-no-drag
              >
                {crumb.name}
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ============================================================================
// Folder Row Component
// ============================================================================

function FolderRow({
  folder,
  onClick,
  onContextMenu,
  isHovered,
  isAnyHovered,
  onHover,
}: {
  folder: LibraryFolder;
  onClick: () => void;
  onContextMenu: () => void;
  isHovered: boolean;
  isAnyHovered: boolean;
  onHover: () => void;
}) {
  const titleClass = cn(
    "flex-1 min-w-0 transition-colors duration-200",
    isHovered
      ? "text-foreground"
      : isAnyHovered
        ? "text-muted-foreground/80"
        : "text-foreground",
  );

  const mutedClass = cn(
    "transition-colors duration-200",
    isAnyHovered && !isHovered
      ? "text-muted-foreground/80"
      : "text-muted-foreground",
  );

  return (
    <div
      className="grid grid-cols-[4rem_1fr_minmax(12rem,auto)] gap-4 py-3 border-b border-border/40 items-baseline cursor-pointer"
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu();
      }}
      onMouseEnter={onHover}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span className={cn(mutedClass, "text-base")}>
        <svg
          className="w-4 h-4 inline-block"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      </span>
      <span className={titleClass}>{folder.name}</span>
      <span className={cn(mutedClass, "text-right")}>
        {folder.itemCount} {folder.itemCount === 1 ? "item" : "items"}
      </span>
    </div>
  );
}

// ============================================================================
// Paper Row Component
// ============================================================================

function PaperRow({
  paper,
  onClick,
  onContextMenu,
  isHovered,
  isAnyHovered,
  onHover,
}: {
  paper: Paper;
  onClick: (openInNewTab: boolean) => void;
  onContextMenu: () => void;
  isHovered: boolean;
  isAnyHovered: boolean;
  onHover: () => void;
}) {
  const { metadata } = paper;
  const displayTitle = metadata.title || paper.filename;
  const displayAuthors =
    metadata.authors.length > 0
      ? metadata.authors.length > 2
        ? `${metadata.authors[0]} et al.`
        : metadata.authors.join(", ")
      : null;

  const handleClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    const openInNewTab = e.metaKey || e.ctrlKey;
    onClick(openInNewTab);
  };

  const titleClass = cn(
    "flex-1 min-w-0 transition-colors duration-200",
    isHovered
      ? "text-foreground"
      : isAnyHovered
        ? "text-muted-foreground/80"
        : "text-foreground",
  );

  const mutedClass = cn(
    "transition-colors duration-200",
    isAnyHovered && !isHovered
      ? "text-muted-foreground/80"
      : "text-muted-foreground",
  );

  return (
    <div
      className="grid grid-cols-[4rem_1fr_minmax(12rem,auto)] gap-4 py-3 border-b border-border/40 items-baseline cursor-pointer"
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu();
      }}
      onMouseEnter={onHover}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick(e);
        }
      }}
    >
      <span className={cn(mutedClass, "tabular-nums")}>
        {metadata.year || "—"}
      </span>
      <span className={titleClass}>{displayTitle}</span>
      <span className={cn(mutedClass, "text-right truncate")}>
        {displayAuthors || "—"}
      </span>
    </div>
  );
}

// ============================================================================
// Create Folder Dialog
// ============================================================================

function CreateFolderDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
}) {
  const [folderName, setFolderName] = useState("");

  const handleCreate = () => {
    if (folderName.trim()) {
      onCreate(folderName.trim());
      setFolderName("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Folder</DialogTitle>
          <DialogDescription>
            Enter a name for the new folder.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!folderName.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Delete Confirmation Dialog
// ============================================================================

function DeleteConfirmDialog({
  open,
  onOpenChange,
  itemName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{itemName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the item
            and all its contents.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================================
// Main Paper Library Component
// ============================================================================

export function PaperLibrary({
  workspacePath,
  onSelectPaper,
}: PaperLibraryProps) {
  const {
    currentPath,
    items,
    isLoading,
    error,
    breadcrumbs,
    navigateTo,
    importFromPaths,
    createNewFolder,
    deleteLibraryItem,
    refresh,
  } = usePaperLibrary(workspacePath);

  const [isDragOver, setIsDragOver] = useState(false);
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

  // Full-page drag and drop
  useEffect(() => {
    const webview = getCurrentWebview();

    const setupListener = async () => {
      const unlisten = await webview.onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setIsDragOver(true);
        } else if (event.payload.type === "drop") {
          setIsDragOver(false);

          const paths = event.payload.paths.filter((path) => {
            const ext = `.${path.split(".").pop()?.toLowerCase()}`;
            return ext === ".pdf";
          });

          if (paths.length > 0) {
            importFromPaths(paths);
          }
        } else if (event.payload.type === "leave") {
          setIsDragOver(false);
        }
      });

      return unlisten;
    };

    const unlistenPromise = setupListener();

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [importFromPaths]);

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
    return item.type === "folder"
      ? `folder:${item.path}`
      : `paper:${item.paper.id}`;
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        className={cn(
          "h-screen flex flex-col transition-colors",
          isDragOver && "bg-muted/30",
        )}
      >
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
                  } else {
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
                                  item.paper.metadata.title ||
                                  item.paper.filename,
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
                  }
                })
              )}
            </div>
          </div>

          {/* Drag overlay hint */}
          {isDragOver && (
            <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
              <p className="font-mono text-sm tracking-wide text-muted-foreground">
                Drop to add
              </p>
            </div>
          )}
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
