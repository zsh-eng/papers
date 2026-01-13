/**
 * Phase 2: Content extraction from PDF.
 *
 * Full markdown conversion with figure bounding boxes.
 * This is the slow path (~30-200 seconds depending on document length).
 */

import { readFile } from "fs/promises";
import { z } from "zod";
import { EXTRACTION_MODEL, getGeminiClient } from "./client";
import { contentResponseSchema } from "./schemas";
import type { ContentOptions, ExtractedContent } from "./types";

const CONTENT_PROMPT = `Convert this PDF to clean, well-structured markdown.

Guidelines for markdown conversion:
1. Preserve all text content accurately
2. Use proper heading levels (# for title, ## for sections, ### for subsections)
3. Format lists, tables, and code blocks appropriately
4. For mathematical equations, use LaTeX syntax:
   - Inline math: $equation$
   - Display math: $$equation$$
5. Do NOT include:
   - Page numbers
   - Running headers/footers
   - Line numbers
   - Redundant whitespace

For figures and images:
1. Insert markdown image placeholders where figures appear: ![Figure N: caption](figures/fig_N.png)
2. Identify each figure's bounding box for extraction
3. The bounding box should be [x1, y1, x2, y2] in PDF points (72 points = 1 inch)
4. Coordinates start from top-left of the page
5. Include the caption if visible

For tables:
- Use standard markdown table syntax
- Preserve alignment where possible

Output the complete document as markdown, maintaining the logical reading order.`;

const CONTENT_NO_FIGURES_PROMPT = `Convert this PDF to clean, well-structured markdown.

Guidelines for markdown conversion:
1. Preserve all text content accurately
2. Use proper heading levels (# for title, ## for sections, ### for subsections)
3. Format lists, tables, and code blocks appropriately
4. For mathematical equations, use LaTeX syntax:
   - Inline math: $equation$
   - Display math: $$equation$$
5. Do NOT include:
   - Page numbers
   - Running headers/footers
   - Line numbers
   - Redundant whitespace

For figures: Simply note where they appear with a placeholder like [Figure N here].

For tables:
- Use standard markdown table syntax
- Preserve alignment where possible

Output the complete document as markdown, maintaining the logical reading order.`;

/**
 * Extract content from a PDF file.
 *
 * @param pdfPath - Path to the PDF file
 * @param options - Extraction options
 * @returns Extracted markdown content and figure bounding boxes
 */
export async function extractContent(
  pdfPath: string,
  options: ContentOptions = {},
): Promise<ExtractedContent> {
  const { skipFigures = false } = options;

  const client = getGeminiClient();

  // Read PDF as base64
  const pdfBuffer = await readFile(pdfPath);
  const pdfBase64 = pdfBuffer.toString("base64");

  // Convert Zod schema to JSON Schema for Gemini
  const jsonSchema = z.toJSONSchema(contentResponseSchema);
  const prompt = skipFigures ? CONTENT_NO_FIGURES_PROMPT : CONTENT_PROMPT;

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
  const validated = contentResponseSchema.parse(parsed);

  return validated;
}
