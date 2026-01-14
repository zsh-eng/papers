/**
 * Phase 2: Content extraction from PDF.
 *
 * Full markdown conversion without structured output constraints.
 * This allows the model to focus entirely on accurate text extraction.
 */

import { readFile } from "fs/promises";
import { EXTRACTION_MODEL, getGeminiClient } from "./client";
import type { ContentOptions, Figure } from "./types";

/**
 * Build the content extraction prompt.
 * If figures are provided, include placeholders for the model to insert.
 */
function buildPrompt(figures: Figure[]): string {
  let prompt = `Convert this PDF to clean, well-structured markdown.

## Guidelines

1. Preserve ALL text content accurately - do not summarize or skip sections
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

## Tables

Use standard markdown table syntax. Preserve alignment where possible.

## Output

Output the complete document as markdown, maintaining the logical reading order.
Do NOT wrap the output in code fences - just output raw markdown directly.`;

  if (figures.length > 0) {
    prompt += `

## Figures

Insert these figure placeholders at the appropriate locations in the text where the figures appear:

${figures.map((f) => `- ${f.id}: ![${f.caption || `Figure ${f.id.replace("fig_", "")}`}](figures/${f.id}.png)`).join("\n")}

Place each placeholder on its own line where the figure appears in the document flow.`;
  } else {
    prompt += `

## Figures

For any figures or images, insert a simple placeholder: [Figure N here]`;
  }

  return prompt;
}

/**
 * Extract content from a PDF file as plain markdown.
 *
 * @param pdfPath - Path to the PDF file
 * @param options - Extraction options including figure info from metadata
 * @returns Plain markdown string
 */
export async function extractContent(
  pdfPath: string,
  options: ContentOptions = {},
): Promise<string> {
  const { figures = [] } = options;

  const client = getGeminiClient();

  // Read PDF as base64
  const pdfBuffer = await readFile(pdfPath);
  const pdfBase64 = pdfBuffer.toString("base64");

  const prompt = buildPrompt(figures);

  // No structured output - just get plain text markdown
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
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from Gemini API");
  }

  // Clean up any accidental code fence wrapping
  let markdown = text.trim();
  if (markdown.startsWith("```markdown")) {
    markdown = markdown.slice(11);
  } else if (markdown.startsWith("```")) {
    markdown = markdown.slice(3);
  }
  if (markdown.endsWith("```")) {
    markdown = markdown.slice(0, -3);
  }

  return markdown.trim();
}
