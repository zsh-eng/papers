/**
 * Markdown frontmatter parsing utilities.
 *
 * Custom implementation to avoid Node.js dependencies (like Buffer) that aren't available in browser/Tauri environments.
 */

export interface ParsedMarkdown {
  /** Frontmatter data */
  data: Record<string, unknown>;
  /** Markdown body content (without frontmatter) */
  content: string;
}

/**
 * Parse markdown content to extract frontmatter and body.
 *
 * Supports YAML frontmatter delimited by --- at the start of the file.
 */
export function parseMarkdown(content: string): ParsedMarkdown {
  const lines = content.split("\n");

  // Check if file starts with frontmatter delimiter
  if (lines.length < 3 || lines[0].trim() !== "---") {
    return { data: {}, content };
  }

  // Find the closing delimiter
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIndex = i;
      break;
    }
  }

  // No closing delimiter found
  if (endIndex === -1) {
    return { data: {}, content };
  }

  // Extract frontmatter lines (between the delimiters)
  const frontmatterLines = lines.slice(1, endIndex);
  const bodyLines = lines.slice(endIndex + 1);

  // Parse simple YAML frontmatter (key: value pairs)
  const data: Record<string, unknown> = {};
  for (const line of frontmatterLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue; // Skip empty lines and comments
    }

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) {
      continue; // Not a key-value pair
    }

    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();

    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Try to parse as number or boolean
    if (value === "true") {
      data[key] = true;
    } else if (value === "false") {
      data[key] = false;
    } else if (value === "null") {
      data[key] = null;
    } else if (!isNaN(Number(value)) && value !== "") {
      data[key] = Number(value);
    } else {
      data[key] = value;
    }
  }

  return {
    data,
    content: bodyLines.join("\n").trimStart(),
  };
}

/**
 * Extract a title from parsed markdown.
 *
 * Priority:
 * 1. frontmatter.title
 * 2. First H1 heading in content
 * 3. null (caller should use filename)
 */
export function extractTitle(parsed: ParsedMarkdown): string | null {
  // Check frontmatter title
  if (
    typeof parsed.data.title === "string" &&
    parsed.data.title.trim().length > 0
  ) {
    return parsed.data.title.trim();
  }

  // Check for first H1 heading
  const h1Match = parsed.content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  return null;
}

/**
 * Extract author from parsed markdown frontmatter.
 */
export function extractAuthor(parsed: ParsedMarkdown): string | undefined {
  if (
    typeof parsed.data.author === "string" &&
    parsed.data.author.trim().length > 0
  ) {
    return parsed.data.author.trim();
  }
  return undefined;
}
