import { Button } from "@/components/ui/button";
import type { TabInfo } from "@/hooks/use-tab-state";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";

interface TabBarProps {
  tabs: TabInfo[];
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
  tab: TabInfo;
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
        "tab-item group relative flex items-center gap-1.5 px-2 py-0.75 transition-colors select-none rounded-full",
        "flex-1 min-w-0", // Equal distribution, allow shrinking
        isActive
          ? "bg-background text-foreground"
          : "text-muted-foreground hover:bg-background/60",
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
          "shrink-0 p-1 rounded-full transition-all flex items-center justify-center text-muted-foreground",
          "opacity-0 group-hover:opacity-100",
          "hover:bg-foreground/10 hover:text-foreground/70",
        )}
        aria-label="Close tab"
        data-no-drag
      >
        <X className="size-3" />
      </button>

      {/* Tab title */}
      <span className="flex-1 truncate text-xs font-medium text-center text-ellipsis">
        {tab.title}
      </span>

      {/* Keyboard shortcut badge - larger text */}
      {shortcutKey && (
        <span className="shrink-0 text-xs text-muted-foreground/60 mr-1">
          <span className="text-xs mr-px">⌘</span>
          <span>{shortcutKey}</span>
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
      className="tab-bar fixed top-0 left-0 right-0 flex items-center z-50 bg-muted h-(--titlebar-height) pt-1"
      role="tablist"
    >
      {/* Traffic light safe area spacer */}
      <div className="shrink-0 w-(--traffic-light-padding)" />
      {/* Tabs container - no gap, fills available space */}
      <div className="relative flex items-center flex-1 overflow-x-auto no-scrollbar px-1 gap-0.5">
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
      <div className="relative shrink-0 px-2">
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
