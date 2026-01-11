import { readDir, stat, copyFile } from "@tauri-apps/plugin-fs";
import { pathExists } from "@/lib/fs";

export interface Paper {
  id: string;
  filename: string;
  path: string;
  addedAt: Date;
  size: number;
}

/**
 * Get the papers directory path for a workspace
 */
export function getPapersDir(workspacePath: string): string {
  return `${workspacePath}/papers`;
}

/**
 * Extract filename from a file path
 */
function getFilename(filePath: string): string {
  return filePath.split("/").pop() || filePath;
}

/**
 * Import a PDF file from a source path into the papers directory
 * For now, just copies the file. Later will add hashing, metadata extraction, etc.
 */
export async function importPDFFromPath(
  workspacePath: string,
  sourcePath: string
): Promise<Paper> {
  const papersDir = getPapersDir(workspacePath);
  
  // Get filename from source path
  const filename = getFilename(sourcePath);
  const destPath = `${papersDir}/${filename}`;
  
  // Check if file already exists
  const exists = await pathExists(destPath);
  if (exists) {
    throw new Error(`A paper with filename "${filename}" already exists`);
  }
  
  // Get source file info for size
  const sourceInfo = await stat(sourcePath);
  
  // Copy file to destination
  await copyFile(sourcePath, destPath);
  
  return {
    id: filename.replace(/\.pdf$/i, ""), // Simple ID for now
    filename,
    path: destPath,
    addedAt: new Date(),
    size: sourceInfo.size ? Number(sourceInfo.size) : 0,
  };
}

/**
 * List all papers in the workspace
 * Only returns PDFs that exist in the papers directory
 */
export async function listPapers(workspacePath: string): Promise<Paper[]> {
  const papersDir = getPapersDir(workspacePath);
  
  // Check if papers directory exists
  const exists = await pathExists(papersDir);
  if (!exists) {
    return [];
  }
  
  try {
    const entries = await readDir(papersDir);
    const papers: Paper[] = [];
    
    for (const entry of entries) {
      // Only include PDF files
      if (entry.isFile && entry.name.toLowerCase().endsWith(".pdf")) {
        const filePath = `${papersDir}/${entry.name}`;
        try {
          const fileInfo = await stat(filePath);
          papers.push({
            id: entry.name.replace(/\.pdf$/i, ""),
            filename: entry.name,
            path: filePath,
            addedAt: fileInfo.mtime ? new Date(fileInfo.mtime) : new Date(),
            size: fileInfo.size ? Number(fileInfo.size) : 0,
          });
        } catch {
          // Skip files we can't stat
        }
      }
    }
    
    // Sort by added date, newest first
    return papers.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
  } catch {
    return [];
  }
}
