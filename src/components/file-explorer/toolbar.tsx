import { useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  RefreshCw,
  FilePlus,
  FolderPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ToolbarProps {
  canGoBack: boolean;
  canGoUp: boolean;
  disabled: boolean;
  onGoBack: () => void;
  onGoUp: () => void;
  onRefresh: () => void;
  onCreateFile: (name: string) => void;
  onCreateFolder: (name: string) => void;
}

export function Toolbar({
  canGoBack,
  canGoUp,
  disabled,
  onGoBack,
  onGoUp,
  onRefresh,
  onCreateFile,
  onCreateFolder,
}: ToolbarProps) {
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreateFile = () => {
    if (newName.trim()) {
      onCreateFile(newName.trim());
      setNewName("");
      setShowNewFile(false);
    }
  };

  const handleCreateFolder = () => {
    if (newName.trim()) {
      onCreateFolder(newName.trim());
      setNewName("");
      setShowNewFolder(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      action();
    } else if (e.key === "Escape") {
      setShowNewFile(false);
      setShowNewFolder(false);
      setNewName("");
    }
  };

  return (
    <div className="flex items-center gap-2 py-2 border-b">
      <Button
        variant="ghost"
        size="sm"
        onClick={onGoBack}
        disabled={!canGoBack || disabled}
        title="Go back"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onGoUp}
        disabled={!canGoUp || disabled}
        title="Go up"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={disabled}
        title="Refresh"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>

      <div className="h-4 w-px bg-border mx-1" />

      {showNewFile ? (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="filename.txt"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, handleCreateFile)}
            className="h-8 w-40"
            autoFocus
          />
          <Button size="sm" onClick={handleCreateFile}>
            Create
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowNewFile(false);
              setNewName("");
            }}
          >
            Cancel
          </Button>
        </div>
      ) : showNewFolder ? (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="folder name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, handleCreateFolder)}
            className="h-8 w-40"
            autoFocus
          />
          <Button size="sm" onClick={handleCreateFolder}>
            Create
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowNewFolder(false);
              setNewName("");
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNewFile(true)}
            disabled={disabled}
            title="New file"
          >
            <FilePlus className="h-4 w-4 mr-1" />
            New File
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNewFolder(true)}
            disabled={disabled}
            title="New folder"
          >
            <FolderPlus className="h-4 w-4 mr-1" />
            New Folder
          </Button>
        </>
      )}
    </div>
  );
}
