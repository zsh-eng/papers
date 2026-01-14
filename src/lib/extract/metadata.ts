/**
 * Phase 1: Metadata and figure extraction from PDF.
 *
 * Extracts document type, bibliographic metadata, and figure bounding boxes.
 * Uses structured output for reliable parsing.
 */

import { readFile } from "fs/promises";
import { z } from "zod";
import { EXTRACTION_MODEL, getGeminiClient } from "./client";
import { metadataResponseSchema } from "./schemas";
import type { ExtractedMetadata, MetadataOptions } from "./types";

const METADATA_PROMPT = `Analyze this PDF document and extract:
1. Bibliographic metadata for citation purposes
2. Figure locations and bounding boxes

## Document Type Classification

Determine the document type:
- "article": Journal article (has journal name, volume, issue)
- "conference": Conference paper (has conference name like NeurIPS, ICML, CHI)
- "chapter": Book chapter (part of a larger book)
- "book": Complete book
- "thesis": Dissertation or thesis
- "report": Technical report
- "slides": Presentation slides
- "document": Other/unknown

## Metadata Extraction

Extract all available metadata. Be thorough - this will be used for generating citations.

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

If you cannot find a piece of information, use null for that field.

## Figure Extraction

Scan the ENTIRE document for figures, images, diagrams, and charts.

For each figure:
1. Assign a unique ID: "fig_1", "fig_2", etc. in order of appearance
2. Record the page number (1-indexed)
3. Identify the bounding box [x1, y1, x2, y2] in PDF points (72 points = 1 inch)
   - Coordinates start from top-left of the page
   - Include the entire figure and its caption
4. Extract the caption text if visible
5. Provide bounding box coordinates on a 0-1000 normalized scale:
   - (0, 0) = top-left corner of the page
   - (1000, 1000) = bottom-right corner of the page
   - Include the figure content but NOT the caption text in the bounding box
   - If multiple sub-figures appear together (e.g., "(a)" and "(b)" side by side), treat them as ONE figure with a bounding box encompassing all sub-figures

Include ALL figures in the document, not just the first few pages.`;

/**
 * Extract metadata and figure locations from a PDF file.
 *
 * @param pdfPath - Path to the PDF file
 * @param options - Extraction options
 * @returns Extracted metadata including figure bounding boxes
 */
export async function extractMetadata(
  pdfPath: string,
  options: MetadataOptions = {},
): Promise<ExtractedMetadata> {
  const { context } = options;

  const client = getGeminiClient();

  // Read PDF as base64
  const pdfBuffer = await readFile(pdfPath);
  const pdfBase64 = pdfBuffer.toString("base64");

  // Build prompt with optional context
  let prompt = METADATA_PROMPT;

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
