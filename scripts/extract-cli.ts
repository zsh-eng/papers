#!/usr/bin/env bun
/**
 * CLI tool for PDF extraction.
 *
 * Usage:
 *   bun run scripts/extract-cli.ts metadata <pdf>     # Extract metadata only
 *   bun run scripts/extract-cli.ts content <pdf>      # Extract content + render HTML
 *   bun run scripts/extract-cli.ts full <pdf>         # Run full pipeline
 *
 * Options:
 *   --output-dir, -o <dir>   Output directory (default: same as PDF)
 *   --context, -c <text>     Additional context (citation, course info, etc.)
 *   --skip-figures           Skip figure bounding box extraction
 *   --help, -h               Show help
 *
 * Examples:
 *   bun run scripts/extract-cli.ts metadata paper.pdf
 *   bun run scripts/extract-cli.ts content paper.pdf
 *   bun run scripts/extract-cli.ts full paper.pdf -o ./output
 *   bun run scripts/extract-cli.ts full chapter.pdf --context "Smith, J. (2020). Chapter 3. In Book Title."
 */

import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { basename, dirname, join } from "path";
import { extractContent } from "../src/lib/extract/content";
import { extractMetadata } from "../src/lib/extract/metadata";
import { renderToHtmlDocument } from "../src/lib/extract/render";
import type {
  ExtractedContent,
  ExtractedMetadata,
} from "../src/lib/extract/types";

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

${colors.cyan}Usage:${colors.reset}
  bun run scripts/extract-cli.ts <command> <pdf> [options]

${colors.cyan}Commands:${colors.reset}
  metadata <pdf>    Extract metadata only (fast, ~3-8 seconds)
  content <pdf>     Extract content, render HTML (slow, ~30-200 seconds)
  full <pdf>        Run full pipeline (metadata + content + HTML)

${colors.cyan}Options:${colors.reset}
  --output-dir, -o <dir>   Output directory (default: same as PDF)
  --context, -c <text>     Additional context for extraction (citation, course info, etc.)
  --skip-figures           Skip figure bounding box extraction
  --help, -h               Show this help message

${colors.cyan}Examples:${colors.reset}
  bun run scripts/extract-cli.ts metadata paper.pdf
  bun run scripts/extract-cli.ts content paper.pdf
  bun run scripts/extract-cli.ts full paper.pdf -o ./output
  bun run scripts/extract-cli.ts full chapter.pdf -c "Smith, J. (2020). Chapter 3. In Book Title (pp. 45-67). Publisher."

${colors.cyan}Output Files:${colors.reset}
  meta.json       Bibliographic metadata (Zotero-compatible)
  content.md      Markdown source
  content.html    Pre-rendered HTML (ready for viewing)

${colors.cyan}Environment:${colors.reset}
  GEMINI_API_KEY    Required. Get your key at https://aistudio.google.com/apikey
`);
}

function parseArgs(args: string[]): {
  command: string;
  pdfPath: string;
  outputDir: string;
  context: string;
  skipFigures: boolean;
} {
  let command = "";
  let pdfPath = "";
  let outputDir = "";
  let context = "";
  let skipFigures = false;

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
    } else if (arg === "--skip-figures") {
      skipFigures = true;
    } else if (!command) {
      command = arg;
    } else if (!pdfPath) {
      pdfPath = arg;
    }
    i++;
  }

  return { command, pdfPath, outputDir, context, skipFigures };
}

function getOutputPaths(pdfPath: string, outputDir: string) {
  const dir = outputDir || dirname(pdfPath);
  const base = basename(pdfPath, ".pdf");

  return {
    dir,
    metadataJson: join(dir, `${base}.meta.json`),
    contentJson: join(dir, `${base}.content.json`),
    markdown: join(dir, `${base}.md`),
    html: join(dir, `${base}.html`),
  };
}

async function runMetadata(
  pdfPath: string,
  outputDir: string,
  context?: string,
): Promise<ExtractedMetadata> {
  info(`Extracting metadata from ${basename(pdfPath)}...`);
  if (context) {
    log(
      `   ${colors.dim}Context: ${context.slice(0, 60)}${context.length > 60 ? "..." : ""}${colors.reset}`,
    );
  }
  const startTime = Date.now();

  const metadata = await extractMetadata(pdfPath, { context });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const paths = getOutputPaths(pdfPath, outputDir);
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
  log(`   Output: ${paths.metadataJson}`);

  return metadata;
}

async function runContent(
  pdfPath: string,
  outputDir: string,
  skipFigures: boolean,
): Promise<ExtractedContent> {
  const paths = getOutputPaths(pdfPath, outputDir);

  // Check if metadata exists
  if (!existsSync(paths.metadataJson)) {
    error(`Metadata file not found: ${paths.metadataJson}`);
    error(
      `Run 'metadata' command first, or use 'full' for the complete pipeline.`,
    );
    process.exit(1);
  }

  // Load metadata to check type and get title
  const metadataRaw = await readFile(paths.metadataJson, "utf-8");
  const metadata: ExtractedMetadata = JSON.parse(metadataRaw);

  if (metadata.type === "slides") {
    info(`Document is slides - skipping content extraction`);
    return { markdown: "", figures: [] };
  }

  info(`Extracting content from ${basename(pdfPath)}...`);
  info(`This may take 30-200 seconds for long documents.`);
  const startTime = Date.now();

  const content = await extractContent(pdfPath, { skipFigures });
  const extractTime = ((Date.now() - startTime) / 1000).toFixed(1);

  // Save markdown
  await writeFile(paths.contentJson, JSON.stringify(content, null, 2));
  await writeFile(paths.markdown, content.markdown);

  success(`Content extracted in ${extractTime}s`);
  log(`   Markdown: ${content.markdown.length.toLocaleString()} chars`);
  log(`   Figures: ${content.figures.length}`);

  // Render HTML
  info(`Rendering HTML...`);
  const renderStart = Date.now();
  const html = await renderToHtmlDocument(content.markdown);
  const renderTime = ((Date.now() - renderStart) / 1000).toFixed(1);
  await writeFile(paths.html, html);

  success(`HTML rendered in ${renderTime}s`);
  log(`   Output: ${paths.markdown}`);
  log(`   Output: ${paths.html}`);

  // TODO: Extract figures from bounding boxes using mupdf-js
  if (content.figures.length > 0 && !skipFigures) {
    info(
      `Figure extraction not yet implemented (${content.figures.length} figures found)`,
    );
  }

  return content;
}

async function runFull(
  pdfPath: string,
  outputDir: string,
  skipFigures: boolean,
  context?: string,
) {
  // Ensure output directory exists
  if (outputDir && !existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  info(`Running full extraction pipeline...`);
  log("");

  // Phase 1: Metadata
  const metadata = await runMetadata(pdfPath, outputDir, context);
  log("");

  // Phase 2: Content + HTML (skip for slides)
  if (metadata.type !== "slides") {
    await runContent(pdfPath, outputDir, skipFigures);
  } else {
    info(`Skipping content extraction for slides`);
  }

  log("");
  success(`Pipeline complete!`);
}

async function main() {
  const args = process.argv.slice(2);
  const { command, pdfPath, outputDir, context, skipFigures } = parseArgs(args);

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
      case "content":
        await runContent(pdfPath, outputDir, skipFigures);
        break;
      case "full":
        await runFull(pdfPath, outputDir, skipFigures, context || undefined);
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
