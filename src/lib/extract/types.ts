/**
 * Types for PDF extraction pipeline.
 *
 * Phase 1: Metadata + figure extraction (structured output, ~5-15 seconds)
 * Phase 2: Content extraction (plain markdown, ~30-200 seconds)
 */

/** Document type determines how the PDF is processed and displayed */
export type DocumentType =
  | "article" // Journal article
  | "book" // Full book
  | "chapter" // Book chapter
  | "conference" // Conference paper
  | "thesis" // Dissertation/thesis
  | "report" // Technical report
  | "slides" // Presentation slides
  | "document"; // Generic/unknown

/** Structured author name for proper citation formatting */
export interface Author {
  /** Given/first name */
  given: string;
  /** Family/last name */
  family: string;
}

/** Bounding box for figure extraction [x1, y1, x2, y2] in PDF points */
export type BoundingBox = [number, number, number, number];

/** Figure identified in the PDF */
export interface Figure {
  /** Unique identifier, e.g., "fig_1" */
  id: string;
  /** Page number (0-indexed) */
  page: number;
  /** Bounding box coordinates */
  bbox: BoundingBox;
  /** Figure caption if found */
  caption: string | null;
}

/** Metadata extracted from PDF - compatible with Zotero/citation managers */
export interface ExtractedMetadata {
  // === Core fields (always present) ===
  /** Document classification */
  type: DocumentType;
  /** Full title of the document */
  title: string;
  /** List of authors with structured names */
  authors: Author[];
  /** Publication year */
  year: number | null;
  /** Total number of pages in PDF */
  pageCount: number;

  // === Identifiers ===
  /** DOI identifier */
  doi: string | null;
  /** URL if no DOI available */
  url: string | null;
  /** ISBN for books */
  isbn: string | null;

  // === Journal article fields ===
  /** Journal name */
  journal: string | null;
  /** Volume number */
  volume: string | null;
  /** Issue number */
  issue: string | null;
  /** Page range (e.g., "123-145") */
  pages: string | null;

  // === Book/chapter fields ===
  /** Parent book title (for chapters) */
  bookTitle: string | null;
  /** Publisher name */
  publisher: string | null;
  /** Edition (e.g., "2nd") */
  edition: string | null;
  /** Editors for edited volumes */
  editors: Author[] | null;

  // === Conference fields ===
  /** Conference or venue name */
  conference: string | null;

  // === Content ===
  /** Abstract text */
  abstract: string | null;
  /** Keywords/tags */
  keywords: string[] | null;

  // === Figures ===
  /** Figures with bounding boxes for extraction */
  figures: Figure[];

  // === Processing metadata ===
  /** ISO timestamp when extracted */
  extractedAt: string;
  /** User-provided citation (stored for fallback) */
  providedCitation: string | null;
  /** User-provided context */
  providedContext: string | null;
}

/** Options for metadata extraction */
export interface MetadataOptions {
  /** User-provided context to help with extraction (citation, course info, etc.) */
  context?: string;
}

/** Options for content extraction */
export interface ContentOptions {
  /** Figure information from metadata phase for markdown placeholders */
  figures?: Figure[];
}

/** Options for the full extraction pipeline */
export interface ExtractionOptions {
  /** Output directory (default: same as PDF) */
  outputDir?: string;
  /** User-provided context (citation, course info, etc.) */
  context?: string;
}

/** Result of full extraction pipeline - files written to disk */
export interface ExtractionResult {
  /** Path to meta.json */
  metadataPath: string;
  /** Path to content.md */
  markdownPath: string;
  /** Path to content.html */
  htmlPath: string;
  /** Paths to extracted figure images */
  figurePaths: string[];
}
