import { cn } from "@/lib/utils";
import { motion } from "motion/react";

export type ViewMode = "md" | "pdf";

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewModeToggle({
  value,
  onChange,
  className,
}: ViewModeToggleProps) {
  return (
    <div
      className={cn(
        "fixed top-2 right-2 inline-flex items-center rounded-md bg-muted p-0.5 z-20",
        className,
      )}
    >
      {/* Animated background pill */}
      <motion.div
        className="absolute inset-y-1 rounded-sm bg-background shadow-sm"
        initial={false}
        animate={{
          x: value === "md" ? 2 : "calc(100% - 2px)",
          width: "calc(50% - 2px)",
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 35,
        }}
      />

      {/* MD button */}
      <button
        type="button"
        onClick={() => onChange("md")}
        className={cn(
          "relative z-10 px-2.5 py-1 text-xs font-medium tracking-wide transition-colors w-12 text-center",
          value === "md"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground/70",
        )}
      >
        MD
      </button>

      {/* PDF button */}
      <button
        type="button"
        onClick={() => onChange("pdf")}
        className={cn(
          "relative z-10 px-2.5 py-1 text-xs font-medium tracking-wide transition-colors w-12",
          value === "pdf"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground/70",
        )}
      >
        PDF
      </button>
    </div>
  );
}
