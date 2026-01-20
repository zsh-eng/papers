import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useCommandRegistry } from "@/lib/commands/registry";
import { getKeySymbol, getModifierSymbol } from "@/lib/commands/shortcut-utils";
import type { Command as CommandType, Shortcut } from "@/lib/commands/types";
import MiniSearch from "minisearch";
import { useCallback, useMemo, useState } from "react";

interface ActionCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ShortcutDisplay({ shortcut }: { shortcut: Shortcut }) {
  return (
    <KbdGroup>
      {shortcut.modifiers.map((mod) => (
        <Kbd key={mod}>{getModifierSymbol(mod)}</Kbd>
      ))}
      <Kbd>{getKeySymbol(shortcut.key)}</Kbd>
    </KbdGroup>
  );
}

export function ActionCommandPalette({
  open,
  onOpenChange,
}: ActionCommandPaletteProps) {
  const registry = useCommandRegistry();
  const [query, setQuery] = useState("");

  // Get visible commands when palette opens
  const visibleCommands = useMemo(
    () => (open ? registry.getVisibleCommands() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  // Build search index
  const searchIndex = useMemo(() => {
    const index = new MiniSearch<CommandType>({
      fields: ["title", "id"],
      storeFields: ["id", "title", "shortcut", "icon"],
      searchOptions: {
        boost: { title: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
    index.addAll(visibleCommands);
    return index;
  }, [visibleCommands]);

  // Filter commands
  const results = useMemo(() => {
    if (!query.trim()) return visibleCommands;
    return searchIndex
      .search(query)
      .map((r) => visibleCommands.find((c) => c.id === r.id)!)
      .filter(Boolean);
  }, [query, searchIndex, visibleCommands]);

  const handleSelect = useCallback(
    async (cmd: CommandType) => {
      onOpenChange(false);
      setQuery("");
      await registry.execute(cmd.id);
    },
    [registry, onOpenChange],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={(newOpen) => {
        onOpenChange(newOpen);
        if (!newOpen) setQuery("");
      }}
      title="Command Palette"
      description="Search and run commands"
      className="max-w-xl"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Type a command..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-80 pb-1">
          <CommandEmpty>No commands found.</CommandEmpty>
          {results.map((cmd) => (
            <CommandItem
              key={cmd.id}
              value={cmd.id}
              onSelect={() => handleSelect(cmd)}
              className="flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                {cmd.icon && (
                  <cmd.icon className="size-4 text-muted-foreground" />
                )}
                <span>{cmd.title}</span>
              </span>
              {cmd.shortcut && <ShortcutDisplay shortcut={cmd.shortcut} />}
            </CommandItem>
          ))}
        </CommandList>
        <div className="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground flex items-center justify-center">
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
              Enter
            </kbd>{" "}
            to use
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}
