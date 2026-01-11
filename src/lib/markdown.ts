import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

/**
 * Creates a unified processor for converting markdown to HTML
 * Pipeline: markdown → remark-parse → remark-gfm → remark-math → remark-rehype → rehype-katex → rehype-highlight → HTML
 */
function createMarkdownProcessor() {
  return unified()
    .use(remarkParse) // Parse markdown to mdast
    .use(remarkGfm) // GitHub Flavored Markdown (tables, strikethrough, etc.)
    .use(remarkMath) // Parse math syntax ($...$ and $$...$$)
    .use(remarkRehype, { allowDangerousHtml: true }) // Convert mdast to hast
    .use(rehypeKatex) // Render math with KaTeX
    .use(rehypeHighlight) // Syntax highlighting for code blocks
    .use(rehypeStringify, { allowDangerousHtml: true }); // Convert hast to HTML string
}

// Singleton processor instance for efficiency
let processorInstance: ReturnType<typeof createMarkdownProcessor> | null = null;

function getProcessor() {
  if (!processorInstance) {
    processorInstance = createMarkdownProcessor();
  }
  return processorInstance;
}

/**
 * Render markdown content to HTML string
 * @param markdown - The markdown content to render
 * @returns HTML string
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  const processor = getProcessor();
  const result = await processor.process(markdown);
  return String(result);
}

/**
 * Strip YAML frontmatter from markdown content
 * @param content - Markdown content potentially containing frontmatter
 * @returns Content without frontmatter
 */
export function stripFrontmatter(content: string): string {
  const frontmatterRegex = /^---\n[\s\S]*?\n---\n?/;
  return content.replace(frontmatterRegex, "").trim();
}

/**
 * Render markdown content to HTML, stripping frontmatter first
 * @param markdown - The markdown content (may include frontmatter)
 * @returns HTML string
 */
export async function renderMarkdownContent(markdown: string): Promise<string> {
  const contentWithoutFrontmatter = stripFrontmatter(markdown);
  return renderMarkdown(contentWithoutFrontmatter);
}
