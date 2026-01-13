import {
  readDir,
  mkdir,
  remove,
  exists,
  stat,
  writeTextFile,
  type DirEntry,
  type FileInfo,
} from "@tauri-apps/plugin-fs";

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  size?: number;
  modifiedAt?: Date;
}

/**
 * List contents of a directory
 */
export async function listDirectory(path: string): Promise<FileEntry[]> {
  const entries: DirEntry[] = await readDir(path);

  const fileEntries: FileEntry[] = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = `${path}/${entry.name}`;
      let fileInfo: FileInfo | null = null;

      try {
        fileInfo = await stat(fullPath);
      } catch {
        // Ignore stat errors (e.g., permission denied)
      }

      return {
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory,
        isFile: entry.isFile,
        size: fileInfo?.size ? Number(fileInfo.size) : undefined,
        modifiedAt: fileInfo?.mtime ? new Date(fileInfo.mtime) : undefined,
      };
    }),
  );

  // Sort: directories first, then alphabetically
  return fileEntries.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Create an empty file
 */
export async function createFile(
  directory: string,
  name: string,
): Promise<string> {
  const path = `${directory}/${name}`;
  await writeTextFile(path, "");
  return path;
}

/**
 * Create a directory
 */
export async function createFolder(
  directory: string,
  name: string,
): Promise<string> {
  const path = `${directory}/${name}`;
  await mkdir(path);
  return path;
}

/**
 * Delete a file or directory
 */
export async function deleteItem(path: string): Promise<void> {
  await remove(path, { recursive: true });
}

/**
 * Check if a path exists
 */
export async function pathExists(path: string): Promise<boolean> {
  return exists(path);
}

/**
 * Get file/directory info
 */
export async function getFileInfo(path: string): Promise<FileInfo> {
  return stat(path);
}
