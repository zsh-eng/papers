#!/usr/bin/env bun
/**
 * CLI tool for PDF extraction.
 *
 * Usage:
 *   bun run scripts/extract-cli.ts metadata <pdf>     # Extract metadata only
 *   bun run scripts/extract-cli.ts content <pdf>      # Extract content (requires metadata first)
 *   bun run scripts/extract-cli.ts full <pdf>         # Run full pipeline
 *
 * Options:
 *   --output-dir, -o <dir>   Output directory (default: same as PDF)
 *   --skip-figures           Skip figure bounding box extraction
 *   --help, -h               Show help
 *
 * Examples:
 *   bun run scripts/extract-cli.ts metadata paper.pdf
 *   bun run scripts/extract-cli.ts content paper.pdf
 *   bun run scripts/extract-cli.ts full paper.pdf -o ./output
 */

import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { basename, dirname, join } from "path";
import { extractContent } from "../src/lib/extract/content";
import { extractMetadata } from "../src/lib/extract/metadata";
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
  content <pdf>     Extract content and figures (slow, ~30-200 seconds)
  full <pdf>        Run full pipeline (metadata + content)

${colors.cyan}Options:${colors.reset}
  --output-dir, -o <dir>   Output directory (default: same as PDF)
  --skip-figures           Skip figure bounding box extraction
  --help, -h               Show this help message

${colors.cyan}Examples:${colors.reset}
  bun run scripts/extract-cli.ts metadata paper.pdf
  bun run scripts/extract-cli.ts content paper.pdf
  bun run scripts/extract-cli.ts full paper.pdf -o ./output

${colors.cyan}Output Files:${colors.reset}
  metadata:  <pdf>.meta.json
  content:   <pdf>.content.json, <pdf>.md

${colors.cyan}Environment:${colors.reset}
  GEMINI_API_KEY    Required. Get your key at https://aistudio.google.com/apikey
`);
}

function parseArgs(args: string[]): {
  command: string;
  pdfPath: string;
  outputDir: string;
  skipFigures: boolean;
} {
  let command = "";
  let pdfPath = "";
  let outputDir = "";
  let skipFigures = false;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg === "--output-dir" || arg === "-o") {
      outputDir = args[++i];
    } else if (arg === "--skip-figures") {
      skipFigures = true;
    } else if (!command) {
      command = arg;
    } else if (!pdfPath) {
      pdfPath = arg;
    }
    i++;
  }

  return { command, pdfPath, outputDir, skipFigures };
}

function getOutputPaths(pdfPath: string, outputDir: string) {
  const dir = outputDir || dirname(pdfPath);
  const base = basename(pdfPath, ".pdf");

  return {
    metadataJson: join(dir, `${base}.meta.json`),
    contentJson: join(dir, `${base}.content.json`),
    markdown: join(dir, `${base}.md`),
  };
}

async function runMetadata(
  pdfPath: string,
  outputDir: string,
): Promise<ExtractedMetadata> {
  info(`Extracting metadata from ${basename(pdfPath)}...`);
  const startTime = Date.now();

  const metadata = await extractMetadata(pdfPath);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const paths = getOutputPaths(pdfPath, outputDir);
  await writeFile(paths.metadataJson, JSON.stringify(metadata, null, 2));

  success(`Metadata extracted in ${elapsed}s`);
  log(`   Type: ${colors.cyan}${metadata.type}${colors.reset}`);
  log(`   Title: ${metadata.title}`);
  log(`   Authors: ${metadata.authors.join(", ") || "Unknown"}`);
  log(`   Year: ${metadata.year || "Unknown"}`);
  log(`   Pages: ${metadata.pageCount}`);
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

  // Load metadata to check type
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
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Save outputs
  await writeFile(paths.contentJson, JSON.stringify(content, null, 2));
  await writeFile(paths.markdown, content.markdown);

  success(`Content extracted in ${elapsed}s`);
  log(`   Markdown: ${content.markdown.length.toLocaleString()} chars`);
  log(`   Figures: ${content.figures.length}`);
  log(`   Output: ${paths.markdown}`);

  return content;
}

async function runFull(
  pdfPath: string,
  outputDir: string,
  skipFigures: boolean,
) {
  // Ensure output directory exists
  if (outputDir && !existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  info(`Running full extraction pipeline...`);
  log("");

  // Phase 1: Metadata
  const metadata = await runMetadata(pdfPath, outputDir);
  log("");

  // Phase 2: Content (skip for slides)
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
  const { command, pdfPath, outputDir, skipFigures } = parseArgs(args);

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
        await runMetadata(pdfPath, outputDir);
        break;
      case "content":
        await runContent(pdfPath, outputDir, skipFigures);
        break;
      case "full":
        await runFull(pdfPath, outputDir, skipFigures);
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
