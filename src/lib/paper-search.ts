import { readDir } from "@tauri-apps/plugin-fs";
import { pathExists } from "@/lib/fs";
import {
  getPapersDir,
  isPaperFolder,
  loadMarkdownFile,
  loadPaper,
  type MarkdownFile,
  type Paper,
} from "@/lib/papers";

/**
 * Search item for papers in the command palette
 */
export interface PaperSearchItem {
  type: "paper";
  id: string;
  title: string;
  authors: string;
  year: string;
  displayPath: string;
  paper: Paper;
}

/**
 * Search item for markdown files in the command palette
 */
export interface MarkdownSearchItem {
  type: "markdown";
  id: string;
  title: string;
  author: string;
  modifiedAt: Date;
  displayPath: string;
  markdown: MarkdownFile;
}

/**
 * Union type for all search items
 */
export type SearchItem = PaperSearchItem | MarkdownSearchItem;

/**
 * Check if a directory name is hidden (starts with a dot)
 */
export function isHiddenDirectory(name: string): boolean {
  return name.startsWith(".");
}

/**
 * Result of listing all items in a workspace
 */
export interface ListAllItemsResult {
  papers: PaperSearchItem[];
  markdowns: MarkdownSearchItem[];
}

/**
 * Recursively list all papers and markdown files in the workspace.
 * - Skips hidden directories (starting with .)
 * - Does not recurse into paper folders (they have a fixed structure)
 * - Collects markdown files from regular folders only
 */
export async function listAllItems(
  workspacePath: string,
): Promise<ListAllItemsResult> {
  const papersDir = getPapersDir(workspacePath);

  if (!(await pathExists(papersDir))) {
    return { papers: [], markdowns: [] };
  }

  const papers: PaperSearchItem[] = [];
  const markdowns: MarkdownSearchItem[] = [];
  await collectItemsRecursive(papersDir, "", papers, markdowns);

  // Sort papers by year descending, then title ascending
  papers.sort((a, b) => {
    const yearA = parseInt(a.year) || 0;
    const yearB = parseInt(b.year) || 0;
    if (yearB !== yearA) {
      return yearB - yearA;
    }
    return a.title.localeCompare(b.title);
  });

  // Sort markdowns by modification date descending, then title ascending
  markdowns.sort((a, b) => {
    const timeA = a.modifiedAt.getTime();
    const timeB = b.modifiedAt.getTime();
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return a.title.localeCompare(b.title);
  });

  return { papers, markdowns };
}

/**
 * Recursively list all papers in the workspace, including those in subfolders.
 * Returns a flat list of PaperSearchItem for use in the command palette.
 * @deprecated Use listAllItems instead to get both papers and markdown files
 */
export async function listAllPapers(
  workspacePath: string,
): Promise<PaperSearchItem[]> {
  const result = await listAllItems(workspacePath);
  return result.papers;
}

/**
 * Recursively collect papers and markdown files from a directory
 */
async function collectItemsRecursive(
  currentPath: string,
  relativePath: string,
  papers: PaperSearchItem[],
  markdowns: MarkdownSearchItem[],
): Promise<void> {
  try {
    const entries = await readDir(currentPath);

    for (const entry of entries) {
      // Skip hidden directories and files
      if (isHiddenDirectory(entry.name)) {
        continue;
      }

      const entryPath = `${currentPath}/${entry.name}`;
      const entryRelativePath = relativePath
        ? `${relativePath}/${entry.name}`
        : entry.name;

      if (entry.isDirectory) {
        if (isPaperFolder(entry.name)) {
          // This is a paper folder - load it but don't recurse into it
          const paper = await loadPaper(entryPath);
          if (paper) {
            papers.push(paperToSearchItem(paper, relativePath));
          }
        } else {
          // This is a regular folder - recurse into it
          await collectItemsRecursive(
            entryPath,
            entryRelativePath,
            papers,
            markdowns,
          );
        }
      } else if (entry.isFile && entry.name.endsWith(".md")) {
        // This is a markdown file in a regular folder
        const markdown = await loadMarkdownFile(entryPath);
        if (markdown) {
          markdowns.push(markdownToSearchItem(markdown, relativePath));
        }
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
    type: "paper",
    id: paper.path, // Use full path as unique ID
    title: paper.metadata.title,
    authors,
    year,
    displayPath,
    paper,
  };
}

/**
 * Convert a MarkdownFile to a MarkdownSearchItem
 */
function markdownToSearchItem(
  markdown: MarkdownFile,
  folderPath: string,
): MarkdownSearchItem {
  // Display path shows the folder hierarchy, e.g., "/ML/notes"
  // Root level markdowns show just "/"
  const displayPath = folderPath ? `/${folderPath}` : "/";

  return {
    type: "markdown",
    id: markdown.path, // Use full path as unique ID
    title: markdown.metadata.title,
    author: markdown.metadata.author || "",
    modifiedAt: markdown.modifiedAt,
    displayPath,
    markdown,
  };
}
