import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tab } from "@/hooks/use-tabs";
import { Button } from "@/components/ui/button";

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
}

function TabItem({
  tab,
  index,
  isActive,
  onSwitch,
  onClose,
}: {
  tab: Tab;
  index: number;
  isActive: boolean;
  onSwitch: () => void;
  onClose: () => void;
}) {
  // Show shortcut badge for tabs 1-9
  const shortcutKey = index < 9 ? index + 1 : null;

  return (
    <div
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      onClick={onSwitch}
      onAuxClick={(e) => {
        // Middle click to close
        if (e.button === 1) {
          e.preventDefault();
          onClose();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSwitch();
        }
      }}
      className={cn(
        "tab-item group relative flex items-center gap-1.5 px-3 py-1.5 rounded-md cursor-pointer transition-colors select-none",
        "min-w-[120px] max-w-[200px]",
        isActive
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
      data-no-drag
    >
      {/* Close button - fades in on hover, positioned on left */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className={cn(
          "tab-close-btn flex-shrink-0 p-0.5 rounded-sm transition-all",
          "opacity-0 group-hover:opacity-100",
          "hover:bg-foreground/10"
        )}
        aria-label="Close tab"
        data-no-drag
      >
        <X className="w-3 h-3" />
      </button>

      {/* Tab title */}
      <span className="flex-1 truncate text-xs font-medium">{tab.title}</span>

      {/* Keyboard shortcut badge */}
      {shortcutKey && (
        <span className="flex-shrink-0 text-[10px] text-muted-foreground/60 font-mono">
          ⌘{shortcutKey}
        </span>
      )}
    </div>
  );
}

export function TabBar({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onNewTab,
}: TabBarProps) {
  return (
    <div
      className="tab-bar fixed top-0 left-0 right-0 h-[var(--titlebar-height)] flex items-center z-50"
      role="tablist"
    >
      {/* Traffic light safe area spacer */}
      <div className="flex-shrink-0 w-[var(--traffic-light-padding)]" />

      {/* Tabs container */}
      <div className="relative flex items-center gap-1 flex-1 overflow-x-auto no-scrollbar pr-2">
        {tabs.map((tab, index) => (
          <TabItem
            key={tab.id}
            tab={tab}
            index={index}
            isActive={tab.id === activeTabId}
            onSwitch={() => onSwitchTab(tab.id)}
            onClose={() => onCloseTab(tab.id)}
          />
        ))}
      </div>

      {/* New tab button */}
      <div className="relative flex-shrink-0 pr-3">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onNewTab}
          className="text-muted-foreground hover:text-foreground"
          data-no-drag
          aria-label="New tab"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
