import { readDir } from "@tauri-apps/plugin-fs";
import { pathExists } from "@/lib/fs";
import { getPapersDir, isPaperFolder, loadPaper, type Paper } from "@/lib/papers";

/**
 * Search item for the command palette
 */
export interface PaperSearchItem {
  id: string;
  title: string;
  authors: string;
  year: string;
  displayPath: string;
  paper: Paper;
}

/**
 * Recursively list all papers in the workspace, including those in subfolders.
 * Returns a flat list of PaperSearchItem for use in the command palette.
 */
export async function listAllPapers(
  workspacePath: string
): Promise<PaperSearchItem[]> {
  const papersDir = getPapersDir(workspacePath);

  if (!(await pathExists(papersDir))) {
    return [];
  }

  const items: PaperSearchItem[] = [];
  await collectPapersRecursive(papersDir, "", items);

  // Sort by year descending, then title ascending
  return items.sort((a, b) => {
    const yearA = parseInt(a.year) || 0;
    const yearB = parseInt(b.year) || 0;
    if (yearB !== yearA) {
      return yearB - yearA;
    }
    return a.title.localeCompare(b.title);
  });
}

/**
 * Recursively collect papers from a directory
 */
async function collectPapersRecursive(
  currentPath: string,
  relativePath: string,
  items: PaperSearchItem[]
): Promise<void> {
  try {
    const entries = await readDir(currentPath);

    for (const entry of entries) {
      if (!entry.isDirectory) continue;

      const entryPath = `${currentPath}/${entry.name}`;
      const entryRelativePath = relativePath
        ? `${relativePath}/${entry.name}`
        : entry.name;

      if (isPaperFolder(entry.name)) {
        // This is a paper folder - load it
        const paper = await loadPaper(entryPath);
        if (paper) {
          items.push(paperToSearchItem(paper, relativePath));
        }
      } else {
        // This is a regular folder - recurse into it
        await collectPapersRecursive(entryPath, entryRelativePath, items);
      }
    }
  } catch (err) {
    console.error(`Failed to read directory ${currentPath}:`, err);
  }
}

/**
 * Convert a Paper to a PaperSearchItem
 */
function paperToSearchItem(paper: Paper, folderPath: string): PaperSearchItem {
  const authors = paper.metadata.authors.join(", ");
  const year = paper.metadata.year?.toString() || "";
  
  // Display path shows the folder hierarchy, e.g., "/ML/transformers"
  // Root level papers show just "/"
  const displayPath = folderPath ? `/${folderPath}` : "/";

  return {
    id: paper.path, // Use full path as unique ID
    title: paper.metadata.title,
    authors,
    year,
    displayPath,
    paper,
  };
}
