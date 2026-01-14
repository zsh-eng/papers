/**
 * Figure extraction from PDF using pdftocairo.
 *
 * Extracts figures from PDFs using bounding box coordinates from metadata.
 * Requires poppler-utils to be installed (provides pdftocairo).
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import { dirname, join } from "path";
import type { Figure } from "./types";

/** Options for figure extraction */
export interface FigureExtractionOptions {
  /** DPI for rendering (default: 300) */
  dpi?: number;
  /** Output format (default: png) */
  format?: "png" | "jpeg";
}

/**
 * Get page dimensions in PDF points for a specific page.
 *
 * @param pdfPath - Path to the PDF file
 * @param pageNum - Page number (1-indexed)
 * @returns Page dimensions { width, height } in PDF points
 */
function getPageDimensions(
  pdfPath: string,
  pageNum: number,
): { width: number; height: number } {
  // Use pdfinfo to get page dimensions
  const cmd = `pdfinfo -f ${pageNum} -l ${pageNum} "${pdfPath}"`;
  const output = execSync(cmd, { encoding: "utf-8" });

  // Parse output for page size
  // Format: "Page    1 size:  612 x 792 pts (letter)"
  const sizeMatch = output.match(
    /Page\s+\d+\s+size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/,
  );
  if (!sizeMatch) {
    throw new Error(`Could not determine page size for page ${pageNum}`);
  }

  return {
    width: parseFloat(sizeMatch[1]),
    height: parseFloat(sizeMatch[2]),
  };
}

/**
 * Extract a single figure from a PDF.
 *
 * @param pdfPath - Path to the PDF file
 * @param figure - Figure metadata with bounding box (0-1000 normalized coordinates)
 * @param outputPath - Path for the output image (without extension)
 * @param options - Extraction options
 * @returns Path to the extracted image
 */
export function extractFigure(
  pdfPath: string,
  figure: Figure,
  outputPath: string,
  options: FigureExtractionOptions = {},
): string {
  const { dpi = 300, format = "png" } = options;
  // 0-indexed page number
  const pageNum = figure.page + 1;

  // Get actual page dimensions in PDF points
  const pageDims = getPageDimensions(pdfPath, pageNum);

  // Convert from 0-1000 normalized coordinates to PDF points
  const [x1Norm, y1Norm, x2Norm, y2Norm] = figure.bbox;
  const x1Pts = (x1Norm / 1000) * pageDims.width;
  const y1Pts = (y1Norm / 1000) * pageDims.height;
  const x2Pts = (x2Norm / 1000) * pageDims.width;
  const y2Pts = (y2Norm / 1000) * pageDims.height;

  // Convert PDF points (72 per inch) to pixels at target DPI
  const scale = dpi / 72;

  const x = Math.floor(x1Pts * scale);
  const y = Math.floor(y1Pts * scale);
  const width = Math.floor((x2Pts - x1Pts) * scale);
  const height = Math.floor((y2Pts - y1Pts) * scale);

  // Ensure output directory exists
  const outDir = dirname(outputPath);
  if (!existsSync(outDir)) {
    execSync(`mkdir -p "${outDir}"`);
  }

  // Remove extension if present - pdftocairo adds it
  const outBase = outputPath.replace(/\.(png|jpeg|jpg)$/i, "");

  // Build pdftocairo command
  const formatFlag = format === "jpeg" ? "-jpeg" : "-png";
  const cmd = [
    "pdftocairo",
    formatFlag,
    // To avoid the page number in the suffix
    `-singlefile`,
    `-r ${dpi}`,
    `-f ${pageNum}`,
    `-l ${pageNum}`,
    `-x ${x}`,
    `-y ${y}`,
    `-W ${width}`,
    `-H ${height}`,
    `"${pdfPath}"`,
    `"${outBase}"`,
  ].join(" ");

  execSync(cmd, { stdio: "pipe" });

  const ext = format === "jpeg" ? "jpg" : "png";
  return `${outBase}.${ext}`;
}

/**
 * Extract all figures from a PDF.
 *
 * @param pdfPath - Path to the PDF file
 * @param figures - Array of figure metadata from extraction
 * @param outputDir - Directory to save figures
 * @param options - Extraction options
 * @returns Array of paths to extracted images
 */
export async function extractAllFigures(
  pdfPath: string,
  figures: Figure[],
  outputDir: string,
  options: FigureExtractionOptions = {},
): Promise<string[]> {
  if (figures.length === 0) {
    return [];
  }

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  const paths: string[] = [];

  for (const figure of figures) {
    const outputPath = join(outputDir, figure.id);
    try {
      const resultPath = extractFigure(pdfPath, figure, outputPath, options);
      paths.push(resultPath);
    } catch (err) {
      // Log error but continue with other figures
      console.error(
        `Failed to extract ${figure.id}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  return paths;
}

/**
 * Check if pdftocairo is available on the system.
 */
export function checkPdftocairoAvailable(): boolean {
  try {
    execSync("which pdftocairo", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
