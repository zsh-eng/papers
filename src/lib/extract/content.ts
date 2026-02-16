/**
 * Phase 2: Content extraction from PDF.
 *
 * Full markdown conversion without structured output constraints.
 * This allows the model to focus entirely on accurate text extraction.
 */

import { readFile } from "fs/promises";
import { generateContentWithFallback } from "./client";
import type { ContentOptions, Figure } from "./types";

/**
 * Build the content extraction prompt.
 * If figures are provided, include placeholders for the model to insert.
 */
function buildPrompt(figures: Figure[]): string {
  let prompt = `Transcribe this PDF document into markdown for academic research purposes.

## Guidelines

1. Transcribe ALL text content accurately from the images/pages. Do not summarize or skip sections.
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

## Important Note
This transcription is for personal research and fair use analysis of the provided document. Please provide the full text as it appears in the PDF.

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

function fixBlockMath(text: string) {
  // Match lines that start with $$ and end with $$
  // They need to be separated by blank lines for Katex to work properly
  return text.replace(/^\$\$(.+)\$\$$/gm, "\n$$$$\n$1\n$$$$\n");
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

  // Read PDF as base64
  const pdfBuffer = await readFile(pdfPath);
  const pdfBase64 = pdfBuffer.toString("base64");

  const prompt = buildPrompt(figures);

  // No structured output - just get plain text markdown
  const response = await generateContentWithFallback({
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
    const blockReason = response.promptFeedback?.blockReason;
    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const detail = blockReason
      ? `blocked: ${blockReason}`
      : finishReason
        ? `finishReason=${finishReason}`
        : "no candidates returned";
    throw new Error(`Empty response from Gemini API (${detail})`);
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
  markdown = fixBlockMath(markdown);

  return markdown.trim();
}
