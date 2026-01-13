/**
 * Zod schemas for Gemini API structured output.
 */

import { z } from "zod";

/** Schema for document type - matches Zotero item types */
export const documentTypeSchema = z.enum([
  "article", // Journal article
  "book", // Full book
  "chapter", // Book chapter
  "conference", // Conference paper
  "thesis", // Dissertation/thesis
  "report", // Technical report
  "slides", // Presentation slides
  "document", // Generic/unknown
]);

/** Schema for structured author name */
export const authorSchema = z.object({
  given: z.string().describe("Given/first name"),
  family: z.string().describe("Family/last name"),
});

/** Schema for Phase 1: Metadata extraction response */
export const metadataResponseSchema = z.object({
  // Core fields
  type: documentTypeSchema.describe(
    "Document type: 'article' for journal papers, 'conference' for conference papers, 'chapter' for book chapters, 'book' for full books, 'thesis' for dissertations, 'report' for technical reports, 'slides' for presentations, 'document' for other",
  ),
  title: z.string().describe("Full title of the document"),
  authors: z
    .array(authorSchema)
    .describe("List of authors with structured names"),
  year: z.number().nullable().describe("Publication year, null if not found"),

  // Identifiers
  doi: z.string().nullable().describe("DOI identifier if present"),
  url: z.string().nullable().describe("URL if no DOI available"),
  isbn: z.string().nullable().describe("ISBN for books"),

  // Journal article fields
  journal: z.string().nullable().describe("Journal name for articles"),
  volume: z.string().nullable().describe("Volume number"),
  issue: z.string().nullable().describe("Issue number"),
  pages: z.string().nullable().describe("Page range (e.g., '123-145')"),

  // Book/chapter fields
  bookTitle: z
    .string()
    .nullable()
    .describe("Parent book title for chapters"),
  publisher: z.string().nullable().describe("Publisher name"),
  edition: z.string().nullable().describe("Edition (e.g., '2nd')"),
  editors: z
    .array(authorSchema)
    .nullable()
    .describe("Editors for edited volumes"),

  // Conference fields
  conference: z
    .string()
    .nullable()
    .describe("Conference or venue name"),

  // Content
  abstract: z.string().nullable().describe("Abstract or summary text"),
  keywords: z
    .array(z.string())
    .nullable()
    .describe("Keywords or tags"),
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
