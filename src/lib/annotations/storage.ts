import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  type Annotation,
  type AnnotationsFile,
  ANNOTATIONS_SCHEMA_VERSION,
} from "./types";

const ANNOTATIONS_FILENAME = "annotations.json";

/**
 * Load annotations from a paper's annotations.json file.
 * Returns an empty array if the file doesn't exist.
 */
export async function loadAnnotations(paperPath: string): Promise<Annotation[]> {
  const filePath = `${paperPath}/${ANNOTATIONS_FILENAME}`;

  try {
    const content = await readTextFile(filePath);
    const data: AnnotationsFile = JSON.parse(content);

    // Validate version for future migrations
    if (data.version !== ANNOTATIONS_SCHEMA_VERSION) {
      console.warn(
        `Annotations file version ${data.version} differs from current ${ANNOTATIONS_SCHEMA_VERSION}`
      );
    }

    return data.annotations;
  } catch {
    // File doesn't exist yet - return empty array
    return [];
  }
}

/**
 * Save annotations to a paper's annotations.json file.
 */
export async function saveAnnotations(
  paperPath: string,
  annotations: Annotation[]
): Promise<void> {
  const filePath = `${paperPath}/${ANNOTATIONS_FILENAME}`;

  const data: AnnotationsFile = {
    version: ANNOTATIONS_SCHEMA_VERSION,
    annotations,
  };

  await writeTextFile(filePath, JSON.stringify(data, null, 2));
}

/**
 * Generate a unique ID for a new annotation.
 */
export function generateAnnotationId(): string {
  return crypto.randomUUID();
}
