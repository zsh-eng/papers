import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

export interface ParsedFrontmatter {
  title?: string;
  authors?: string[];
  year?: number;
  doi?: string;
  tags?: string[];
}

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
 * Parse YAML frontmatter from markdown content
 * @param content - Markdown content potentially containing frontmatter
 * @returns Parsed frontmatter object
 */
export function parseFrontmatter(content: string): ParsedFrontmatter {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return {};
  }

  const frontmatter = frontmatterMatch[1];
  const result: ParsedFrontmatter = {};

  // Parse title
  const titleMatch = frontmatter.match(/^title:\s*"(.+)"/m);
  if (titleMatch) {
    result.title = titleMatch[1];
  }

  // Parse year
  const yearMatch = frontmatter.match(/^year:\s*(\d+|null)/m);
  if (yearMatch && yearMatch[1] !== "null") {
    result.year = parseInt(yearMatch[1], 10);
  }

  // Parse doi
  const doiMatch = frontmatter.match(/^doi:\s*"(.+)"/m);
  if (doiMatch) {
    result.doi = doiMatch[1];
  }

  // Parse authors (simple approach - look for array items)
  const authorsMatch = frontmatter.match(/^authors:\n((?:\s+-\s+".+"\n?)+)/m);
  if (authorsMatch) {
    const authorLines = authorsMatch[1].match(/-\s+"(.+)"/g);
    if (authorLines) {
      result.authors = authorLines.map((line) => {
        const match = line.match(/-\s+"(.+)"/);
        return match ? match[1] : "";
      }).filter(Boolean);
    }
  }

  // Parse tags
  const tagsMatch = frontmatter.match(/^tags:\s*\[(.*)\]/m);
  if (tagsMatch) {
    const tagsContent = tagsMatch[1];
    if (tagsContent.trim()) {
      result.tags = tagsContent
        .split(",")
        .map((t) => t.trim().replace(/^"|"$/g, ""))
        .filter((t) => t);
    }
  }

  return result;
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

/**
 * Strip the first H1 heading from markdown content
 * Used when title is rendered separately from frontmatter
 * @param content - Markdown content
 * @returns Content without the first H1
 */
export function stripFirstHeading(content: string): string {
  // Remove the first # heading line (title) since we display it separately
  return content.replace(/^#\s+.+\n+/, "").trim();
}

/**
 * Render markdown content to HTML, stripping frontmatter and first heading
 * @param markdown - The markdown content (may include frontmatter)
 * @returns HTML string
 */
export async function renderMarkdownBody(markdown: string): Promise<string> {
  const contentWithoutFrontmatter = stripFrontmatter(markdown);
  const contentWithoutHeading = stripFirstHeading(contentWithoutFrontmatter);
  return renderMarkdown(contentWithoutHeading);
}
