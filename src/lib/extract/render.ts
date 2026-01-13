/**
 * Markdown to HTML rendering for the extraction pipeline.
 *
 * This is a standalone renderer for CLI use - no Tauri dependencies.
 * Produces complete HTML documents with embedded styles for KaTeX and syntax highlighting.
 */

import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

/**
 * Creates a unified processor for converting markdown to HTML.
 *
 * Pipeline: markdown → remark-parse → remark-gfm → remark-math →
 *           remark-rehype → rehype-katex → rehype-highlight → HTML
 */
function createProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeKatex)
    .use(rehypeHighlight)
    .use(rehypeStringify, { allowDangerousHtml: true });
}

// Singleton processor instance
let processor: ReturnType<typeof createProcessor> | null = null;

function getProcessor() {
  if (!processor) {
    processor = createProcessor();
  }
  return processor;
}

/**
 * Strip YAML frontmatter from markdown content.
 */
export function stripFrontmatter(content: string): string {
  const frontmatterRegex = /^---\n[\s\S]*?\n---\n?/;
  return content.replace(frontmatterRegex, "").trim();
}

/**
 * Strip the first H1 heading from markdown content.
 * Used when title is rendered separately from metadata.
 */
export function stripFirstHeading(content: string): string {
  return content.replace(/^#\s+.+\n+/, "").trim();
}

/**
 * Render markdown string to HTML string.
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  const proc = getProcessor();
  const result = await proc.process(markdown);
  return String(result);
}

/**
 * Render markdown content to HTML, stripping frontmatter and title heading.
 *
 * @param markdown - Raw markdown content (may include frontmatter)
 * @returns HTML string (body content only, no wrapper)
 */
export async function renderMarkdownBody(markdown: string): Promise<string> {
  const withoutFrontmatter = stripFrontmatter(markdown);
  const withoutHeading = stripFirstHeading(withoutFrontmatter);
  return renderMarkdown(withoutHeading);
}

/**
 * Render markdown to a complete HTML document with embedded styles.
 *
 * This produces a standalone HTML file that can be viewed directly
 * or loaded by the app without additional processing.
 *
 * @param markdown - Raw markdown content
 * @param title - Document title for the HTML head
 * @returns Complete HTML document string
 */
export async function renderToHtmlDocument(markdown: string): Promise<string> {
  const markdownHtml = await renderMarkdownBody(markdown);
  return markdownHtml;
}
