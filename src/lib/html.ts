import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * Transform relative image sources in HTML to Tauri asset protocol URLs
 */
export function transformImageSources(html: string, baseDir: string): string {
  return html.replace(
    /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*)>/gi,
    (match, before, src, after) => {
      // Skip absolute URLs and already-transformed paths
      if (
        src.startsWith("http") ||
        src.startsWith("asset://") ||
        src.startsWith("file://")
      ) {
        return match;
      }
      // Convert relative path to asset URL
      const absolutePath = `${baseDir}/${src}`;
      const assetUrl = convertFileSrc(absolutePath);
      console.log("transformImageSources:", { src, absolutePath, assetUrl });
      return `<img ${before}src="${assetUrl}"${after}>`;
    },
  );
}
