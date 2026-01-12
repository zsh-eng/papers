import {
  readDir,
  stat,
  copyFile,
  mkdir,
  writeTextFile,
  readTextFile,
  readFile,
} from "@tauri-apps/plugin-fs";
import { pathExists } from "@/lib/fs";

export interface PaperMetadata {
  title: string;
  authors: string[];
  year: number | null;
  doi: string | null;
  abstract: string | null;
  tags: string[];
}

export interface Paper {
  id: string; // folder name: {hash}-{year}-{slug}
  filename: string; // original filename
  path: string; // path to paper folder
  pdfPath: string; // path to index.pdf
  contentPath: string; // path to content.md
  addedAt: Date;
  size: number;
  metadata: PaperMetadata;
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
 * Simple hash function for generating paper IDs
 * Returns first 8 characters of a hex hash
 */
async function hashFile(data: Uint8Array): Promise<string> {
  // Create a new ArrayBuffer from the data
  const buffer = new ArrayBuffer(data.length);
  const view = new Uint8Array(buffer);
  view.set(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex.slice(0, 8);
}

/**
 * Generate a URL-safe slug from a title
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/**
 * Generate the paper folder name: {hash}-{year}-{slug}
 */
function generatePaperFoldername(
  hash: string,
  year: number | null,
  title: string
): string {
  const slug = slugify(title);
  const yearStr = year || "unknown";
  return `${hash}-${yearStr}-${slug}`;
}

/**
 * TODO: Implement actual PDF processing with Gemini/extract_unified.py
 * For now, returns dummy metadata
 */
async function extractMetadata(
  _pdfPath: string,
  originalFilename: string
): Promise<PaperMetadata> {
  // Dummy metadata based on filename
  const titleFromFilename = originalFilename
    .replace(/\.pdf$/i, "")
    .replace(/[-_]/g, " ");

  return {
    title: titleFromFilename,
    authors: ["Unknown Author"],
    year: new Date().getFullYear(),
    doi: null,
    abstract:
      "Abstract not yet extracted. This is placeholder text that will be replaced when the PDF processing pipeline is fully implemented.",
    tags: [],
  };
}

/**
 * TODO: Implement actual PDF to markdown conversion with extract_unified.py
 * For now, returns dummy content
 */
async function extractContent(
  _pdfPath: string,
  metadata: PaperMetadata
): Promise<string> {
  const frontmatter = `---
title: "${metadata.title}"
authors:
${metadata.authors.map((a) => `  - "${a}"`).join("\n")}
year: ${metadata.year || "null"}
doi: ${metadata.doi ? `"${metadata.doi}"` : "null"}
tags: [${metadata.tags.map((t) => `"${t}"`).join(", ")}]
---

`;

  const content = `# ${metadata.title}

${metadata.authors.join(", ")}${metadata.year ? ` (${metadata.year})` : ""}

## Abstract

${metadata.abstract || "No abstract available."}

## Content

*Content extraction not yet implemented. This is placeholder text.*

The full paper content will appear here once the PDF processing pipeline is integrated with extract_unified.py.

<!-- TODO: Implement PDF processing with uv run extract_unified.py -->
`;

  return frontmatter + content;
}

/**
 * Process a PDF file and create the paper folder structure
 */
async function processPaper(
  papersDir: string,
  sourcePath: string
): Promise<Paper> {
  const filename = getFilename(sourcePath);

  // Read the PDF file for hashing
  const pdfData = await readFile(sourcePath);
  const hash = await hashFile(pdfData);

  // Extract metadata (dummy for now)
  const metadata = await extractMetadata(sourcePath, filename);

  // Generate folder name
  const folderName = generatePaperFoldername(hash, metadata.year, metadata.title);
  const paperDir = `${papersDir}/${folderName}`;

  // Check if paper already exists (by hash prefix)
  const existingEntries = await readDir(papersDir).catch(() => []);
  const existingPaper = existingEntries.find((e) => e.name.startsWith(hash));
  if (existingPaper) {
    throw new Error(
      `A paper with this content already exists: ${existingPaper.name}`
    );
  }

  // Create folder structure
  await mkdir(paperDir, { recursive: true });
  await mkdir(`${paperDir}/figures`, { recursive: true });

  // Copy PDF as index.pdf
  const pdfPath = `${paperDir}/index.pdf`;
  await copyFile(sourcePath, pdfPath);

  // Generate and save content.md
  const content = await extractContent(sourcePath, metadata);
  const contentPath = `${paperDir}/content.md`;
  await writeTextFile(contentPath, content);

  // Create empty notes.md
  const notesContent = `# Notes: ${metadata.title}

*Add your notes about this paper here.*
`;
  await writeTextFile(`${paperDir}/notes.md`, notesContent);

  // Create empty annotations.json
  const annotationsContent = JSON.stringify(
    {
      version: 1,
      highlights: [],
    },
    null,
    2
  );
  await writeTextFile(`${paperDir}/annotations.json`, annotationsContent);

  // Get file size
  const fileInfo = await stat(pdfPath);

  return {
    id: folderName,
    filename,
    path: paperDir,
    pdfPath,
    contentPath,
    addedAt: new Date(),
    size: fileInfo.size ? Number(fileInfo.size) : 0,
    metadata,
  };
}

/**
 * Import a PDF file from a source path into the papers directory
 * Creates the full folder structure: {hash}-{year}-{slug}/
 */
export async function importPDFFromPath(
  workspacePath: string,
  sourcePath: string
): Promise<Paper> {
  const papersDir = getPapersDir(workspacePath);

  // Ensure papers directory exists
  if (!(await pathExists(papersDir))) {
    await mkdir(papersDir, { recursive: true });
  }

  return processPaper(papersDir, sourcePath);
}

/**
 * Parse frontmatter from content.md to extract metadata
 */
function parseFrontmatter(content: string): Partial<PaperMetadata> {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return {};
  }

  const frontmatter = frontmatterMatch[1];
  const metadata: Partial<PaperMetadata> = {};

  // Parse title
  const titleMatch = frontmatter.match(/^title:\s*"(.+)"/m);
  if (titleMatch) {
    metadata.title = titleMatch[1];
  }

  // Parse year
  const yearMatch = frontmatter.match(/^year:\s*(\d+|null)/m);
  if (yearMatch && yearMatch[1] !== "null") {
    metadata.year = parseInt(yearMatch[1], 10);
  }

  // Parse doi
  const doiMatch = frontmatter.match(/^doi:\s*"(.+)"/m);
  if (doiMatch) {
    metadata.doi = doiMatch[1];
  }

  // Parse authors (simple approach - look for array items)
  const authorsMatch = frontmatter.match(/^authors:\n((?:\s+-\s+".+"\n?)+)/m);
  if (authorsMatch) {
    const authorLines = authorsMatch[1].match(/-\s+"(.+)"/g);
    if (authorLines) {
      metadata.authors = authorLines.map((line) => {
        const match = line.match(/-\s+"(.+)"/);
        return match ? match[1] : "";
      });
    }
  }

  // Parse tags
  const tagsMatch = frontmatter.match(/^tags:\s*\[(.*)\]/m);
  if (tagsMatch) {
    const tagsContent = tagsMatch[1];
    if (tagsContent.trim()) {
      metadata.tags = tagsContent
        .split(",")
        .map((t) => t.trim().replace(/^"|"$/g, ""))
        .filter((t) => t);
    }
  }

  return metadata;
}

/**
 * Load a paper from its folder path
 */
export async function loadPaper(paperPath: string): Promise<Paper | null> {
  const pdfPath = `${paperPath}/index.pdf`;
  const contentPath = `${paperPath}/content.md`;
  const folderName = paperPath.split("/").pop() || paperPath;

  // Check if this is a valid paper folder
  if (!(await pathExists(pdfPath))) {
    return null;
  }

  // Get PDF info
  const fileInfo = await stat(pdfPath);

  // Try to read and parse content.md for metadata
  let metadata: PaperMetadata = {
    title: folderName,
    authors: [],
    year: null,
    doi: null,
    abstract: null,
    tags: [],
  };

  try {
    const content = await readTextFile(contentPath);
    const parsed = parseFrontmatter(content);
    metadata = {
      title: parsed.title || folderName,
      authors: parsed.authors || [],
      year: parsed.year || null,
      doi: parsed.doi || null,
      abstract: parsed.abstract || null,
      tags: parsed.tags || [],
    };
  } catch {
    // No content.md or parsing failed, use defaults
  }

  const filename = `${folderName}.pdf`;

  return {
    id: folderName,
    filename,
    path: paperPath,
    pdfPath,
    contentPath,
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
  folderName: string
): Promise<Paper | null> {
  const paperDir = `${papersDir}/${folderName}`;
  const pdfPath = `${paperDir}/index.pdf`;
  const contentPath = `${paperDir}/content.md`;

  // Check if this is a valid paper folder
  if (!(await pathExists(pdfPath))) {
    return null;
  }

  // Get PDF info
  const fileInfo = await stat(pdfPath);

  // Try to read and parse content.md for metadata
  let metadata: PaperMetadata = {
    title: folderName,
    authors: [],
    year: null,
    doi: null,
    abstract: null,
    tags: [],
  };

  try {
    const content = await readTextFile(contentPath);
    const parsed = parseFrontmatter(content);
    metadata = {
      title: parsed.title || folderName,
      authors: parsed.authors || [],
      year: parsed.year || null,
      doi: parsed.doi || null,
      abstract: parsed.abstract || null,
      tags: parsed.tags || [],
    };
  } catch {
    // No content.md or parsing failed, use defaults
  }

  // Try to extract original filename from somewhere, or use folder name
  const filename = `${folderName}.pdf`;

  return {
    id: folderName,
    filename,
    path: paperDir,
    pdfPath,
    contentPath,
    addedAt: fileInfo.mtime ? new Date(fileInfo.mtime) : new Date(),
    size: fileInfo.size ? Number(fileInfo.size) : 0,
    metadata,
  };
}

/**
 * List all papers in the workspace
 * Reads from the new folder structure: papers/{hash}-{year}-{slug}/
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
