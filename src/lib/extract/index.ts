/**
 * PDF Extraction Pipeline
 *
 * Two-phase extraction using Gemini 3.0 Flash:
 *
 * Phase 1 - Metadata (fast, ~3-8 seconds):
 *   extractMetadata(pdfPath) → { type, title, authors, year, ... }
 *
 * Phase 2 - Content (slow, ~30-200 seconds):
 *   extractContent(pdfPath) → { markdown, figures }
 *
 * Usage:
 *   import { extractMetadata, extractContent } from '@/lib/extract';
 *
 *   const metadata = await extractMetadata('/path/to/paper.pdf');
 *   if (metadata.type === 'paper') {
 *     const content = await extractContent('/path/to/paper.pdf');
 *   }
 */

export { extractMetadata } from "./metadata";
export { extractContent } from "./content";
export { getGeminiClient, EXTRACTION_MODEL } from "./client";

export type {
  DocumentType,
  ExtractedMetadata,
  Figure,
  BoundingBox,
  MetadataOptions,
  ContentOptions,
} from "./types";

export {
  metadataResponseSchema,
  figureSchema,
  documentTypeSchema,
} from "./schemas";
