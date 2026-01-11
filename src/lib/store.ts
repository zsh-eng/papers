import { LazyStore } from "@tauri-apps/plugin-store";

const store = new LazyStore("settings.json");

const WORKSPACE_PATH_KEY = "workspacePath";

/**
 * Get the saved workspace path from the store
 */
export async function getWorkspacePath(): Promise<string | null> {
  const path = await store.get<string>(WORKSPACE_PATH_KEY);
  return path ?? null;
}

/**
 * Save the workspace path to the store
 */
export async function setWorkspacePath(path: string): Promise<void> {
  await store.set(WORKSPACE_PATH_KEY, path);
  await store.save();
}

/**
 * Clear the workspace path from the store
 */
export async function clearWorkspacePath(): Promise<void> {
  await store.delete(WORKSPACE_PATH_KEY);
  await store.save();
}
