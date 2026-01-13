/**
 * Phase 1: Metadata extraction from PDF.
 *
 * Fast extraction (~3-8 seconds) of document type and bibliographic metadata.
 * Only sends first few pages to minimize latency.
 */

import { readFile } from "fs/promises";
import { z } from "zod";
import { EXTRACTION_MODEL, getGeminiClient } from "./client";
import { metadataResponseSchema } from "./schemas";
import type { ExtractedMetadata, MetadataOptions } from "./types";

const METADATA_PROMPT = `Analyze this PDF document and extract bibliographic metadata for citation purposes.

First, determine the document type:
- "article": Journal article (has journal name, volume, issue)
- "conference": Conference paper (has conference name like NeurIPS, ICML, CHI)
- "chapter": Book chapter (part of a larger book)
- "book": Complete book
- "thesis": Dissertation or thesis
- "report": Technical report
- "slides": Presentation slides
- "document": Other/unknown

Then extract all available metadata. Be thorough - this will be used for generating citations.

For authors:
- Extract both given (first) and family (last) names separately
- List in order of appearance

For identifiers:
- Look for DOI (usually starts with "10.")
- Look for ISBN (for books)
- Look for URLs

For articles: Extract journal name, volume, issue, page range
For chapters: Extract parent book title, editors, publisher
For conference papers: Extract conference name

If you cannot find a piece of information, use null for that field.`;

/**
 * Extract metadata from a PDF file.
 *
 * @param pdfPath - Path to the PDF file
 * @param options - Extraction options
 * @returns Extracted metadata
 */
export async function extractMetadata(
  pdfPath: string,
  options: MetadataOptions = {},
): Promise<ExtractedMetadata> {
  const { maxPages = 3, context } = options;

  const client = getGeminiClient();

  // Read PDF as base64
  const pdfBuffer = await readFile(pdfPath);
  const pdfBase64 = pdfBuffer.toString("base64");

  // Build prompt with optional context
  let prompt = METADATA_PROMPT;
  prompt += `\n\nNote: Focus on the first ${maxPages} pages for metadata extraction.`;

  if (context) {
    prompt += `\n\n## Additional Context Provided by User\n${context}\n\nUse this context to help fill in metadata fields that may not be visible in the PDF itself (e.g., citation information, book title for chapters, etc.).`;
  }

  // Convert Zod schema to JSON Schema for Gemini
  const jsonSchema = z.toJSONSchema(metadataResponseSchema);
  const response = await client.models.generateContent({
    model: EXTRACTION_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: jsonSchema as object,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from Gemini API");
  }

  const parsed = JSON.parse(text);
  const validated = metadataResponseSchema.parse(parsed);

  // Add processing metadata
  const metadata: ExtractedMetadata = {
    ...validated,
    pageCount: 0, // Will be set by caller who has access to PDF info
    extractedAt: new Date().toISOString(),
    providedCitation: null, // Can be parsed from context if needed
    providedContext: context || null,
  };

  return metadata;
}
