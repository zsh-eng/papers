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

const METADATA_PROMPT = `Analyze this PDF document and extract metadata.

First, determine the document type:
- "paper": Academic paper, journal article, preprint, thesis, or research report
- "slides": Presentation slides, lecture slides, or slideshow
- "document": Other documents (book chapters, manuals, reports, etc.)

Then extract all available metadata. Be thorough but only include information you can actually find in the document.

For authors, list them in the order they appear. For year, look for publication date, copyright year, or any date mentioned. For venue, look for journal names, conference names (like "NeurIPS", "ICML", "Nature"), or publisher information.

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
  const { maxPages = 3 } = options;

  const client = getGeminiClient();

  // Read PDF as base64
  const pdfBuffer = await readFile(pdfPath);
  const pdfBase64 = pdfBuffer.toString("base64");

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
            text:
              METADATA_PROMPT +
              `\n\nNote: Focus on the first ${maxPages} pages for metadata extraction.`,
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

  console.log("TEXT IS", text);

  const parsed = JSON.parse(text);
  const validated = metadataResponseSchema.parse(parsed);

  return validated;
}
