import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import xxhash from "xxhash-wasm";

// Cache file format:
// Line 1: hash of the source markdown content
// Line 2+: the rendered HTML

const CACHE_HEADER_SEPARATOR = "\n<!-- CACHE_BODY -->\n";

// Singleton hasher instance
let hasherInstance: Awaited<ReturnType<typeof xxhash>> | null = null;

async function getHasher() {
  if (!hasherInstance) {
    hasherInstance = await xxhash();
  }
  return hasherInstance;
}

/**
 * Compute xxhash64 of a string, returned as hex
 */
export async function hashContent(content: string): Promise<string> {
  const hasher = await getHasher();
  return hasher.h64(content).toString(16);
}

/**
 * Get the cache file path for a given content.md path
 * e.g., /path/to/paper/content.md -> /path/to/paper/_content.cache.html
 */
export function getCachePath(contentPath: string): string {
  const lastSlash = contentPath.lastIndexOf("/");
  const dir = contentPath.slice(0, lastSlash);
  const filename = contentPath.slice(lastSlash + 1);
  // content.md -> .content.cache.html
  const cacheFilename = "_" + filename.replace(/\.md$/, ".cache.html");
  return `${dir}/${cacheFilename}`;
}

interface CacheData {
  hash: string;
  html: string;
}

/**
 * Read and parse the cache file
 * Returns null if cache doesn't exist or is malformed
 */
async function readCache(cachePath: string): Promise<CacheData | null> {
  try {
    const cacheContent = await readTextFile(cachePath);
    const separatorIndex = cacheContent.indexOf(CACHE_HEADER_SEPARATOR);

    if (separatorIndex === -1) {
      // Malformed cache file
      return null;
    }

    const hash = cacheContent.slice(0, separatorIndex);
    const html = cacheContent.slice(
      separatorIndex + CACHE_HEADER_SEPARATOR.length,
    );

    return { hash, html };
  } catch {
    // File doesn't exist or can't be read
    return null;
  }
}

/**
 * Write HTML and its source hash to the cache file
 */
async function writeCache(
  cachePath: string,
  hash: string,
  html: string,
): Promise<void> {
  const cacheContent = hash + CACHE_HEADER_SEPARATOR + html;
  await writeTextFile(cachePath, cacheContent);
}

export interface CachedRenderResult {
  html: string;
  fromCache: boolean;
  renderTimeMs?: number;
}

/**
 * Get rendered HTML, using cache if available and valid.
 *
 * @param contentPath - Path to the source markdown file (for cache location)
 * @param markdown - The markdown content
 * @param renderFn - Function to render markdown to HTML (called on cache miss)
 * @returns The rendered HTML and whether it came from cache
 */
export async function getCachedHtml(
  contentPath: string,
  markdown: string,
  renderFn: (markdown: string) => Promise<string>,
): Promise<CachedRenderResult> {
  const cachePath = getCachePath(contentPath);
  const contentHash = await hashContent(markdown);

  // Try to read from cache
  const cached = await readCache(cachePath);

  if (cached && cached.hash === contentHash) {
    // Cache hit - hash matches
    console.debug(`[Cache] HIT for ${contentPath}`);
    return {
      html: cached.html,
      fromCache: true,
    };
  }

  // Cache miss - need to render
  console.debug(
    `[Cache] MISS for ${contentPath} (${cached ? "hash mismatch" : "no cache file"})`,
  );

  const startTime = performance.now();
  const html = await renderFn(markdown);
  const renderTimeMs = performance.now() - startTime;

  // Write to cache (fire and forget, don't block on this)
  writeCache(cachePath, contentHash, html).catch((err) => {
    console.warn(`[Cache] Failed to write cache for ${contentPath}:`, err);
  });

  return {
    html,
    fromCache: false,
    renderTimeMs,
  };
}

/**
 * Invalidate (delete) the cache for a content file
 * Useful if you want to force a re-render
 */
export async function invalidateCache(contentPath: string): Promise<void> {
  const cachePath = getCachePath(contentPath);
  try {
    const { remove } = await import("@tauri-apps/plugin-fs");
    await remove(cachePath);
    console.debug(`[Cache] Invalidated cache for ${contentPath}`);
  } catch {
    // Cache file might not exist, that's fine
  }
}
