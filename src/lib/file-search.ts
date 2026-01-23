import { invoke } from "@tauri-apps/api/core";

export interface FileSearchResult {
  path: string;
  display_path: string;
  score: number;
}

/**
 * Search for markdown files using fuzzy matching (reads from cached index)
 */
export async function searchFiles(query: string): Promise<FileSearchResult[]> {
  return invoke<FileSearchResult[]>("search_files", { query });
}

/**
 * Trigger a background refresh of the file index
 */
export async function refreshFileIndex(): Promise<void> {
  return invoke<void>("refresh_file_index");
}
