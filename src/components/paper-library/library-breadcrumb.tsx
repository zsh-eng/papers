import type { Breadcrumb } from "@/hooks/use-paper-library";
import { cn } from "@/lib/utils";

interface LibraryBreadcrumbProps {
  breadcrumbs: Breadcrumb[];
  onNavigate: (path: string) => void;
}

export function LibraryBreadcrumb({
  breadcrumbs,
  onNavigate,
}: LibraryBreadcrumbProps) {
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
