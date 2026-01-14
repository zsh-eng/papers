import { readDir, stat, readTextFile } from "@tauri-apps/plugin-fs";
import { pathExists } from "@/lib/fs";
import type { ExtractedMetadata, Author } from "@/lib/extract/types";

export interface PaperMetadata {
  type: string;
  title: string;
  authors: string[]; // Formatted as "Given Family" for display
  year: number | null;
  doi: string | null;
  abstract: string | null;
  keywords: string[] | null;
}

export interface Paper {
  id: string; // folder name
  path: string; // path to paper folder
  pdfPath: string; // path to source.pdf
  htmlPath: string; // path to content.html
  addedAt: Date;
  size: number;
  metadata: PaperMetadata;
}

// Library item types for folder-based navigation
export interface LibraryFolder {
  type: "folder";
  name: string;
  path: string;
  itemCount: number;
}

export interface LibraryPaper {
  type: "paper";
  paper: Paper;
}

export type LibraryItem = LibraryFolder | LibraryPaper;

/**
 * Regex to identify paper folders: {year}-{slug}
 * Examples: 2017-attention-is-all-you-need, unknown-some-paper
 */
const PAPER_FOLDER_REGEX = /^(\d{4}|unknown)-.+$/;

/**
 * Check if a folder name matches the paper folder format
 */
export function isPaperFolder(folderName: string): boolean {
  return PAPER_FOLDER_REGEX.test(folderName);
}

/**
 * Get the papers directory path for a workspace
 */
export function getPapersDir(workspacePath: string): string {
  return `${workspacePath}/papers`;
}

/**
 * Format Author[] to string[] for display
 */
function formatAuthors(authors: Author[]): string[] {
  return authors.map((a) => `${a.given} ${a.family}`);
}

/**
 * Load a paper from its folder path by reading meta.json
 */
export async function loadPaper(paperPath: string): Promise<Paper | null> {
  const metaPath = `${paperPath}/meta.json`;
  const htmlPath = `${paperPath}/content.html`;
  const pdfPath = `${paperPath}/source.pdf`;
  const folderName = paperPath.split("/").pop() || paperPath;

  // Check if meta.json exists (required for a valid paper)
  if (!(await pathExists(metaPath))) {
    return null;
  }

  // Read and parse meta.json
  let extractedMeta: ExtractedMetadata;
  try {
    const metaContent = await readTextFile(metaPath);
    extractedMeta = JSON.parse(metaContent) as ExtractedMetadata;
  } catch {
    return null; // Invalid or unreadable meta.json
  }

  // Get PDF file info for size and date
  let fileInfo;
  try {
    fileInfo = await stat(pdfPath);
  } catch {
    // PDF might not exist, use defaults
    fileInfo = { size: 0, mtime: null };
  }

  // Convert ExtractedMetadata to PaperMetadata
  const metadata: PaperMetadata = {
    type: extractedMeta.type,
    title: extractedMeta.title,
    authors: formatAuthors(extractedMeta.authors),
    year: extractedMeta.year,
    doi: extractedMeta.doi,
    abstract: extractedMeta.abstract,
    keywords: extractedMeta.keywords,
  };

  return {
    id: folderName,
    path: paperPath,
    pdfPath,
    htmlPath,
    addedAt: fileInfo.mtime ? new Date(fileInfo.mtime) : new Date(),
    size: fileInfo.size ? Number(fileInfo.size) : 0,
    metadata,
  };
}

/**
 * Load a paper from its folder (internal helper)
 */
async function loadPaperFromFolder(
  papersDir: string,
  folderName: string,
): Promise<Paper | null> {
  const paperDir = `${papersDir}/${folderName}`;
  return loadPaper(paperDir);
}

/**
 * List all papers in the workspace
 */
export async function listPapers(workspacePath: string): Promise<Paper[]> {
  const papersDir = getPapersDir(workspacePath);

  // Check if papers directory exists
  if (!(await pathExists(papersDir))) {
    return [];
  }

  try {
    const entries = await readDir(papersDir);
    const papers: Paper[] = [];

    for (const entry of entries) {
      // Only look at directories (paper folders)
      if (entry.isDirectory) {
        const paper = await loadPaperFromFolder(papersDir, entry.name);
        if (paper) {
          papers.push(paper);
        }
      }
    }

    // Sort by added date, newest first
    return papers.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
  } catch {
    return [];
  }
}

/**
 * Count the number of items (folders + papers) in a directory
 */
async function countDirectoryItems(dirPath: string): Promise<number> {
  try {
    const entries = await readDir(dirPath);
    return entries.filter((e) => e.isDirectory).length;
  } catch {
    return 0;
  }
}

/**
 * List library items (folders and papers) from a specific directory path
 * Used for folder-based navigation in the library view
 */
export async function listLibraryItems(
  directoryPath: string,
): Promise<LibraryItem[]> {
  // Check if directory exists
  if (!(await pathExists(directoryPath))) {
    return [];
  }

  try {
    const entries = await readDir(directoryPath);
    const items: LibraryItem[] = [];

    for (const entry of entries) {
      // Only process directories
      if (!entry.isDirectory) {
        continue;
      }

      const entryPath = `${directoryPath}/${entry.name}`;

      if (isPaperFolder(entry.name)) {
        // This is a paper folder - load it as a paper
        const paper = await loadPaper(entryPath);
        if (paper) {
          items.push({ type: "paper", paper });
        }
      } else {
        // This is a regular folder - count its contents
        const itemCount = await countDirectoryItems(entryPath);
        items.push({
          type: "folder",
          name: entry.name,
          path: entryPath,
          itemCount,
        });
      }
    }

    // Sort: folders first (alphabetically), then papers (by year desc, then title asc)
    return items.sort((a, b) => {
      // Folders come first
      if (a.type === "folder" && b.type === "paper") return -1;
      if (a.type === "paper" && b.type === "folder") return 1;

      // Both folders: sort alphabetically
      if (a.type === "folder" && b.type === "folder") {
        return a.name.localeCompare(b.name);
      }

      // Both papers: sort by year desc, then title asc
      if (a.type === "paper" && b.type === "paper") {
        const yearA = a.paper.metadata.year || 0;
        const yearB = b.paper.metadata.year || 0;
        if (yearB !== yearA) {
          return yearB - yearA;
        }
        const titleA = a.paper.metadata.title.toLowerCase();
        const titleB = b.paper.metadata.title.toLowerCase();
        return titleA.localeCompare(titleB);
      }

      return 0;
    });
  } catch {
    return [];
  }
}
