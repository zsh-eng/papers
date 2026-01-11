import { ChevronRight, Folder } from "lucide-react";

interface BreadcrumbsProps {
  items: { name: string; path: string }[];
  onNavigate: (path: string) => void;
}

export function Breadcrumbs({ items, onNavigate }: BreadcrumbsProps) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Folder className="h-4 w-4" />
        <span>No folder selected</span>
      </div>
    );
  }

  return (
    <nav className="flex items-center gap-1 text-sm py-2 overflow-x-auto">
      {items.map((item, index) => (
        <div key={item.path} className="flex items-center gap-1">
          {index > 0 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <button
            onClick={() => onNavigate(item.path)}
            className={`
              flex items-center gap-1 px-2 py-1 rounded hover:bg-accent transition-colors
              ${index === items.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"}
            `}
          >
            {index === 0 && <Folder className="h-4 w-4 flex-shrink-0" />}
            <span className="truncate max-w-[150px]">{item.name}</span>
          </button>
        </div>
      ))}
    </nav>
  );
}
