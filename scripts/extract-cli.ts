#!/usr/bin/env bun
/**
 * CLI tool for PDF extraction.
 *
 * Automatically creates a folder named {year}-{title-slug} for each paper.
 * For example, processing "Attention Is All You Need" (2017) creates:
 *   papers/2017-attention-is-all-you-need/
 *     ├── meta.json
 *     ├── content.md
 *     └── content.html
 *
 * Usage:
 *   bun run scripts/extract-cli.ts metadata <pdf>     # Extract metadata + figures
 *   bun run scripts/extract-cli.ts content <pdf>      # Extract content + render HTML
 *   bun run scripts/extract-cli.ts full <pdf>         # Run full pipeline (recommended)
 *
 * Options:
 *   --output-dir, -o <dir>   Parent directory for paper folder (default: same as PDF)
 *   --context, -c <text>     Additional context (citation, course info, etc.)
 *   --help, -h               Show help
 *
 * Examples:
 *   bun run scripts/extract-cli.ts full paper.pdf -o ~/papers
 *   bun run scripts/extract-cli.ts full paper.pdf -o ~/papers/ml
 *   bun run scripts/extract-cli.ts full chapter.pdf -o ~/papers -c "Smith (2020). Chapter 3."
 */

import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { basename, dirname, join } from "path";
import { extractContent } from "../src/lib/extract/content";
import { extractMetadata } from "../src/lib/extract/metadata";
import { renderToHtmlDocument } from "../src/lib/extract/render";
import type { ExtractedMetadata } from "../src/lib/extract/types";

/**
 * Convert a string to a URL/folder-safe slug.
 * Examples:
 *   "Attention Is All You Need" -> "attention-is-all-you-need"
 *   "CS4223: Cache Coherence" -> "cs4223-cache-coherence"
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "") // Remove apostrophes
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "") // Trim leading/trailing hyphens
    .replace(/-+/g, "-"); // Collapse multiple hyphens
}

/**
 * Generate a folder name from metadata.
 * Format: {year}-{slug} or just {slug} if no year.
 * Examples:
 *   { title: "Attention Is All You Need", year: 2017 } -> "2017-attention-is-all-you-need"
 *   { title: "CS4223 L3: Cache Coherence" } -> "cs4223-l3-cache-coherence"
 */
function generateFolderName(title: string, year?: number): string {
  const slug = slugify(title);
  return year ? `${year}-${slug}` : slug;
}

// ANSI colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string) {
  console.log(message);
}

function success(message: string) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function error(message: string) {
  console.error(`${colors.red}✗${colors.reset} ${message}`);
}

function info(message: string) {
  console.log(`${colors.blue}→${colors.reset} ${message}`);
}

function printHelp() {
  console.log(`
${colors.bright}PDF Extraction CLI${colors.reset}

Automatically creates a folder named {year}-{title-slug} for each paper.

${colors.cyan}Usage:${colors.reset}
  bun run scripts/extract-cli.ts <command> <pdf> [options]

${colors.cyan}Commands:${colors.reset}
  full <pdf>        Run full pipeline (recommended)
  metadata <pdf>    Extract metadata only (~5-15 seconds)
  content <pdf>     Extract content only (requires metadata first)

${colors.cyan}Options:${colors.reset}
  --output-dir, -o <dir>   Parent directory for paper folder (default: same as PDF)
  --context, -c <text>     Additional context (citation, course info, etc.)
  --help, -h               Show this help message

${colors.cyan}Examples:${colors.reset}
  # Process a paper into ~/papers/2017-attention-is-all-you-need/
  bun run scripts/extract-cli.ts full attention.pdf -o ~/papers

  # Organize by topic: ~/papers/ml/2017-attention-is-all-you-need/
  bun run scripts/extract-cli.ts full attention.pdf -o ~/papers/ml

  # With citation context for book chapters
  bun run scripts/extract-cli.ts full chapter.pdf -o ~/papers \\
    -c "Smith, J. (2020). Chapter 3. In Book Title (pp. 45-67). Publisher."

${colors.cyan}Output Structure:${colors.reset}
  {year}-{title-slug}/
    ├── meta.json       Bibliographic metadata + figure bounding boxes
    ├── content.md      Markdown source
    └── content.html    Pre-rendered HTML (ready for viewing)

${colors.cyan}Environment:${colors.reset}
  GEMINI_API_KEY    Required. Get your key at https://aistudio.google.com/apikey
`);
}

function parseArgs(args: string[]): {
  command: string;
  pdfPath: string;
  outputDir: string;
  context: string;
} {
  let command = "";
  let pdfPath = "";
  let outputDir = "";
  let context = "";

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg === "--output-dir" || arg === "-o") {
      outputDir = args[++i];
    } else if (arg === "--context" || arg === "-c") {
      context = args[++i];
    } else if (!command) {
      command = arg;
    } else if (!pdfPath) {
      pdfPath = arg;
    }
    i++;
  }

  return { command, pdfPath, outputDir, context };
}

/**
 * Get output file paths for a paper folder.
 * Files use simple names since they're in their own folder.
 */
function getOutputPaths(paperDir: string) {
  return {
    dir: paperDir,
    metadataJson: join(paperDir, "meta.json"),
    markdown: join(paperDir, "content.md"),
    html: join(paperDir, "content.html"),
  };
}

/**
 * Extract metadata and create the paper folder.
 * Returns metadata and the path to the created paper folder.
 */
async function runMetadata(
  pdfPath: string,
  baseDir: string,
  context?: string,
): Promise<{ metadata: ExtractedMetadata; paperDir: string }> {
  info(`Extracting metadata from ${basename(pdfPath)}...`);
  if (context) {
    log(
      `   ${colors.dim}Context: ${context.slice(0, 60)}${context.length > 60 ? "..." : ""}${colors.reset}`,
    );
  }
  const startTime = Date.now();

  const metadata = await extractMetadata(pdfPath, { context });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Generate folder name from metadata and create it
  const folderName = generateFolderName(metadata.title, metadata.year);
  const parentDir = baseDir || dirname(pdfPath);
  const paperDir = join(parentDir, folderName);

  if (!existsSync(paperDir)) {
    await mkdir(paperDir, { recursive: true });
  }

  const paths = getOutputPaths(paperDir);
  await writeFile(paths.metadataJson, JSON.stringify(metadata, null, 2));

  // Format authors for display
  const authorNames = metadata.authors
    .map((a) => `${a.given} ${a.family}`)
    .join(", ");

  success(`Metadata extracted in ${elapsed}s`);
  log(`   Type: ${colors.cyan}${metadata.type}${colors.reset}`);
  log(`   Title: ${metadata.title}`);
  log(`   Authors: ${authorNames || "Unknown"}`);
  log(`   Year: ${metadata.year || "Unknown"}`);
  if (metadata.doi) log(`   DOI: ${metadata.doi}`);
  if (metadata.journal) log(`   Journal: ${metadata.journal}`);
  if (metadata.conference) log(`   Conference: ${metadata.conference}`);
  log(`   Figures: ${metadata.figures.length}`);
  log(`   Folder: ${paperDir}`);

  return { metadata, paperDir };
}

/**
 * Extract content and render HTML.
 * Writes to the paper folder that was created during metadata extraction.
 */
async function runContent(
  pdfPath: string,
  paperDir: string,
  metadata: ExtractedMetadata,
): Promise<string> {
  const paths = getOutputPaths(paperDir);

  if (metadata.type === "slides") {
    info(`Document is slides - skipping content extraction`);
    return "";
  }

  info(`Extracting content from ${basename(pdfPath)}...`);
  info(`This may take 30-200 seconds for long documents.`);
  const startTime = Date.now();

  // Pass figures from metadata so content knows what placeholders to use
  const markdown = await extractContent(pdfPath, { figures: metadata.figures });
  const extractTime = ((Date.now() - startTime) / 1000).toFixed(1);

  // Save markdown
  await writeFile(paths.markdown, markdown);

  success(`Content extracted in ${extractTime}s`);
  log(`   Markdown: ${markdown.length.toLocaleString()} chars`);

  // Render HTML
  info(`Rendering HTML...`);
  const renderStart = Date.now();
  const html = await renderToHtmlDocument(markdown);
  const renderTime = ((Date.now() - renderStart) / 1000).toFixed(1);
  await writeFile(paths.html, html);

  success(`HTML rendered in ${renderTime}s`);
  log(`   Output: ${paths.markdown}`);
  log(`   Output: ${paths.html}`);

  // TODO: Extract figures from bounding boxes using pdftocairo
  if (metadata.figures.length > 0) {
    info(
      `Figure extraction not yet implemented (${metadata.figures.length} figures found)`,
    );
  }

  return markdown;
}

/**
 * Run the full extraction pipeline.
 * Creates a folder named {year}-{title-slug} inside the output directory.
 */
async function runFull(
  pdfPath: string,
  baseDir: string,
  context?: string,
) {
  // Ensure base directory exists (if specified)
  if (baseDir && !existsSync(baseDir)) {
    await mkdir(baseDir, { recursive: true });
  }

  info(`Running full extraction pipeline...`);
  log("");

  // Phase 1: Metadata + figures (creates the paper folder)
  const { metadata, paperDir } = await runMetadata(pdfPath, baseDir, context);
  log("");

  // Phase 2: Content + HTML (skip for slides)
  if (metadata.type !== "slides") {
    await runContent(pdfPath, paperDir, metadata);
  } else {
    info(`Skipping content extraction for slides`);
  }

  log("");
  success(`Pipeline complete!`);
  log(`   ${colors.cyan}${paperDir}${colors.reset}`);
}

async function main() {
  const args = process.argv.slice(2);
  const { command, pdfPath, outputDir, context } = parseArgs(args);

  if (!command || !pdfPath) {
    printHelp();
    process.exit(1);
  }

  // Validate PDF exists
  if (!existsSync(pdfPath)) {
    error(`PDF file not found: ${pdfPath}`);
    process.exit(1);
  }

  // Check for API key
  if (!process.env.GEMINI_API_KEY) {
    error(`GEMINI_API_KEY environment variable is required.`);
    log(`   Get your API key at: https://aistudio.google.com/apikey`);
    log(
      `   Then run: GEMINI_API_KEY=your_key bun run scripts/extract-cli.ts ...`,
    );
    process.exit(1);
  }

  try {
    switch (command) {
      case "metadata":
        await runMetadata(pdfPath, outputDir, context || undefined);
        break;
      case "content": {
        // Content requires a paper folder with meta.json
        // The folder was created by the 'metadata' command
        if (!outputDir) {
          error(`Content command requires --output-dir pointing to the paper folder.`);
          error(`Run 'metadata' first to create the folder, or use 'full' for the complete pipeline.`);
          process.exit(1);
        }
        const paths = getOutputPaths(outputDir);
        if (!existsSync(paths.metadataJson)) {
          error(`Metadata file not found: ${paths.metadataJson}`);
          error(`Run 'metadata' command first, or use 'full' for the complete pipeline.`);
          process.exit(1);
        }
        const metadataRaw = await readFile(paths.metadataJson, "utf-8");
        const metadata: ExtractedMetadata = JSON.parse(metadataRaw);
        await runContent(pdfPath, outputDir, metadata);
        break;
      }
      case "full":
        await runFull(pdfPath, outputDir, context || undefined);
        break;
      default:
        error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    error(`Extraction failed: ${err instanceof Error ? err.message : err}`);
    if (err instanceof Error && err.stack) {
      log(`${colors.dim}${err.stack}${colors.reset}`);
    }
    process.exit(1);
  }
}

main();
