export const queryKeys = {
  libraryItems: (directoryPath: string | null) =>
    ["libraryItems", directoryPath] as const,
  paperHtml: (paperPath: string) => ["paper", paperPath, "html"] as const,
  paperNotes: (paperPath: string) => ["paper", paperPath, "notes"] as const,
  paperAnnotations: (paperPath: string) =>
    ["paper", paperPath, "annotations"] as const,
  markdownContent: (filePath: string) =>
    ["markdown", filePath, "content"] as const,
  theme: () => ["settings", "theme"] as const,
} as const;
