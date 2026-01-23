import type { LibraryFolder, MarkdownFile, Paper } from "@/lib/papers";
import { cn } from "@/lib/utils";

interface RowHoverProps {
  isHovered: boolean;
  isAnyHovered: boolean;
  onHover: () => void;
}

interface FolderRowProps extends RowHoverProps {
  folder: LibraryFolder;
  onClick: () => void;
  onContextMenu: () => void;
}

export function FolderRow({
  folder,
  onClick,
  onContextMenu,
  isHovered,
  isAnyHovered,
  onHover,
}: FolderRowProps) {
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

interface PaperRowProps extends RowHoverProps {
  paper: Paper;
  onClick: (openInNewTab: boolean) => void;
  onContextMenu: () => void;
}

export function PaperRow({
  paper,
  onClick,
  onContextMenu,
  isHovered,
  isAnyHovered,
  onHover,
}: PaperRowProps) {
  const { metadata } = paper;
  const displayTitle = metadata.title || paper.id;
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
    "line-clamp-1",
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

interface MarkdownRowProps extends RowHoverProps {
  markdown: MarkdownFile;
  onClick: (openInNewTab: boolean) => void;
  onContextMenu: () => void;
}

export function MarkdownRow({
  markdown,
  onClick,
  onContextMenu,
  isHovered,
  isAnyHovered,
  onHover,
}: MarkdownRowProps) {
  const { metadata } = markdown;
  const displayTitle = metadata.title;
  const displayAuthor = metadata.author || null;

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
      <span className={cn(mutedClass, "text-xs font-medium")}>MD</span>
      <span className={titleClass}>{displayTitle}</span>
      <span className={cn(mutedClass, "text-right truncate")}>
        {displayAuthor || "—"}
      </span>
    </div>
  );
}
