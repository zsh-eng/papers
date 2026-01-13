/**
 * Zod schemas for Gemini API structured output.
 */

import { z } from "zod";

/** Schema for document type */
export const documentTypeSchema = z.enum(["paper", "slides", "document"]);

/** Schema for Phase 1: Metadata extraction response */
export const metadataResponseSchema = z.object({
  type: documentTypeSchema.describe(
    "Document type: 'paper' for academic papers/articles, 'slides' for presentations, 'document' for other",
  ),
  title: z.string().describe("Full title of the document"),
  authors: z
    .array(z.string())
    .describe("List of author names in order of appearance"),
  year: z.number().nullable().describe("Publication year, null if not found"),
  venue: z
    .string()
    .nullable()
    .describe("Conference, journal, or publisher name"),
  doi: z.string().nullable().describe("DOI identifier if present"),
  abstract: z.string().nullable().describe("Abstract or summary text"),
  pageCount: z.number().describe("Total number of pages in the document"),
});

/** Schema for a single figure */
export const figureSchema = z.object({
  id: z.string().describe("Unique identifier like 'fig_1', 'fig_2'"),
  page: z.number().describe("Page number (0-indexed)"),
  bbox: z
    .tuple([z.number(), z.number(), z.number(), z.number()])
    .describe("Bounding box [x1, y1, x2, y2] in PDF points from top-left"),
  caption: z.string().nullable().describe("Figure caption if found"),
});

/** Schema for Phase 2: Content extraction response */
export const contentResponseSchema = z.object({
  markdown: z.string().describe("Full document content as clean markdown"),
  figures: z
    .array(figureSchema)
    .describe("List of figures with bounding boxes"),
});

export type MetadataResponse = z.infer<typeof metadataResponseSchema>;
export type ContentResponse = z.infer<typeof contentResponseSchema>;
export type FigureResponse = z.infer<typeof figureSchema>;
