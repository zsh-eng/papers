import { describe, it, expect, vi, beforeEach } from "vitest";
import { isHiddenDirectory, listAllItems } from "./paper-search";

// NOTE: for now we are just mocking, in the future we will think of how to test with real file system

// Mock @tauri-apps/plugin-fs
vi.mock("@tauri-apps/plugin-fs", () => ({
  readDir: vi.fn(),
  readTextFile: vi.fn(),
  stat: vi.fn(),
  exists: vi.fn(),
}));

// Mock @/lib/fs
vi.mock("@/lib/fs", () => ({
  pathExists: vi.fn(),
}));

import { readDir, readTextFile, stat } from "@tauri-apps/plugin-fs";
import { pathExists } from "@/lib/fs";

const mockReadDir = vi.mocked(readDir);
const mockReadTextFile = vi.mocked(readTextFile);
const mockStat = vi.mocked(stat);
const mockPathExists = vi.mocked(pathExists);

// Helper to create a mock FileInfo with only the fields we need
function mockFileInfo(size: number, mtime: Date) {
  return { size, mtime: mtime.getTime() } as unknown as Awaited<
    ReturnType<typeof stat>
  >;
}

describe("isHiddenDirectory", () => {
  it("returns true for dot-prefixed names", () => {
    expect(isHiddenDirectory(".git")).toBe(true);
    expect(isHiddenDirectory(".obsidian")).toBe(true);
    expect(isHiddenDirectory(".hidden")).toBe(true);
  });

  it("returns false for regular names", () => {
    expect(isHiddenDirectory("papers")).toBe(false);
    expect(isHiddenDirectory("2024-my-paper")).toBe(false);
    expect(isHiddenDirectory("notes.md")).toBe(false);
  });
});

describe("listAllItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty arrays when papers directory does not exist", async () => {
    mockPathExists.mockResolvedValue(false);

    const result = await listAllItems("/workspace");

    expect(result).toEqual({ papers: [], markdowns: [] });
    expect(mockPathExists).toHaveBeenCalledWith("/workspace/papers");
  });

  it("returns empty arrays when papers directory is empty", async () => {
    mockPathExists.mockResolvedValue(true);
    mockReadDir.mockResolvedValue([]);

    const result = await listAllItems("/workspace");

    expect(result).toEqual({ papers: [], markdowns: [] });
  });

  it("finds papers in the root papers directory", async () => {
    mockPathExists.mockResolvedValue(true);
    mockReadDir.mockResolvedValue([
      {
        name: "2024-test-paper",
        isDirectory: true,
        isFile: false,
        isSymlink: false,
      },
    ]);
    mockReadTextFile.mockResolvedValue(
      JSON.stringify({
        type: "article",
        title: "Test Paper",
        authors: [{ given: "John", family: "Doe" }],
        year: 2024,
        doi: null,
        abstract: null,
        keywords: null,
      }),
    );
    mockStat.mockResolvedValue(mockFileInfo(1000, new Date("2024-01-01")));

    const result = await listAllItems("/workspace");

    expect(result.papers).toHaveLength(1);
    expect(result.papers[0].title).toBe("Test Paper");
    expect(result.papers[0].authors).toBe("John Doe");
    expect(result.papers[0].year).toBe("2024");
    expect(result.papers[0].displayPath).toBe("/");
    expect(result.markdowns).toHaveLength(0);
  });

  it("finds markdown files in the root papers directory", async () => {
    mockPathExists.mockResolvedValue(true);
    mockReadDir.mockResolvedValue([
      { name: "notes.md", isDirectory: false, isFile: true, isSymlink: false },
    ]);
    mockReadTextFile.mockResolvedValue(`---
title: My Notes
author: Jane Doe
---

# My Notes

Some content here.
`);
    mockStat.mockResolvedValue(mockFileInfo(500, new Date("2024-06-15")));

    const result = await listAllItems("/workspace");

    expect(result.papers).toHaveLength(0);
    expect(result.markdowns).toHaveLength(1);
    expect(result.markdowns[0].title).toBe("My Notes");
    expect(result.markdowns[0].author).toBe("Jane Doe");
    expect(result.markdowns[0].displayPath).toBe("/");
  });

  it("finds papers and markdowns in nested folders", async () => {
    mockPathExists.mockResolvedValue(true);

    // Root level
    mockReadDir.mockResolvedValueOnce([
      { name: "ML", isDirectory: true, isFile: false, isSymlink: false },
    ]);

    // ML folder
    mockReadDir.mockResolvedValueOnce([
      {
        name: "2023-transformer-paper",
        isDirectory: true,
        isFile: false,
        isSymlink: false,
      },
      {
        name: "research-notes.md",
        isDirectory: false,
        isFile: true,
        isSymlink: false,
      },
    ]);

    // Paper meta.json
    // Markdown content
    mockReadTextFile.mockResolvedValueOnce(
      JSON.stringify({
        type: "article",
        title: "Transformer Paper",
        authors: [{ given: "Alice", family: "Smith" }],
        year: 2023,
        doi: null,
        abstract: null,
        keywords: null,
      }),
    ).mockResolvedValueOnce(`---
title: Research Notes
---

Notes about transformers.
`);

    mockStat.mockResolvedValue(mockFileInfo(1000, new Date("2023-05-01")));

    const result = await listAllItems("/workspace");

    expect(result.papers).toHaveLength(1);
    expect(result.papers[0].title).toBe("Transformer Paper");
    expect(result.papers[0].displayPath).toBe("/ML");

    expect(result.markdowns).toHaveLength(1);
    expect(result.markdowns[0].title).toBe("Research Notes");
    expect(result.markdowns[0].displayPath).toBe("/ML");
  });

  it("skips hidden directories", async () => {
    mockPathExists.mockResolvedValue(true);

    mockReadDir.mockResolvedValueOnce([
      { name: ".git", isDirectory: true, isFile: false, isSymlink: false },
      { name: ".obsidian", isDirectory: true, isFile: false, isSymlink: false },
      {
        name: "visible-folder",
        isDirectory: true,
        isFile: false,
        isSymlink: false,
      },
    ]);

    // visible-folder is empty
    mockReadDir.mockResolvedValueOnce([]);

    await listAllItems("/workspace");

    // readDir should only be called for root and visible-folder, not .git or .obsidian
    expect(mockReadDir).toHaveBeenCalledTimes(2);
    expect(mockReadDir).toHaveBeenCalledWith("/workspace/papers");
    expect(mockReadDir).toHaveBeenCalledWith(
      "/workspace/papers/visible-folder",
    );
  });

  it("does not recurse into paper folders", async () => {
    mockPathExists.mockResolvedValue(true);

    // Root level has a paper folder
    mockReadDir.mockResolvedValueOnce([
      {
        name: "2024-test-paper",
        isDirectory: true,
        isFile: false,
        isSymlink: false,
      },
    ]);

    mockReadTextFile.mockResolvedValue(
      JSON.stringify({
        type: "article",
        title: "Test Paper",
        authors: [{ given: "John", family: "Doe" }],
        year: 2024,
        doi: null,
        abstract: null,
        keywords: null,
      }),
    );
    mockStat.mockResolvedValue(mockFileInfo(1000, new Date("2024-01-01")));

    await listAllItems("/workspace");

    // readDir should only be called once for the root, not for the paper folder
    expect(mockReadDir).toHaveBeenCalledTimes(1);
    expect(mockReadDir).toHaveBeenCalledWith("/workspace/papers");
  });

  it("handles papers with unknown year prefix", async () => {
    mockPathExists.mockResolvedValue(true);
    mockReadDir.mockResolvedValue([
      {
        name: "unknown-mystery-paper",
        isDirectory: true,
        isFile: false,
        isSymlink: false,
      },
    ]);
    mockReadTextFile.mockResolvedValue(
      JSON.stringify({
        type: "article",
        title: "Mystery Paper",
        authors: [{ given: "Unknown", family: "Author" }],
        year: null,
        doi: null,
        abstract: null,
        keywords: null,
      }),
    );
    mockStat.mockResolvedValue(mockFileInfo(1000, new Date("2024-01-01")));

    const result = await listAllItems("/workspace");

    expect(result.papers).toHaveLength(1);
    expect(result.papers[0].title).toBe("Mystery Paper");
    expect(result.papers[0].year).toBe("");
  });

  it("handles invalid paper folders gracefully (missing meta.json)", async () => {
    mockPathExists.mockImplementation(async (path) => {
      if (path === "/workspace/papers") return true;
      return false; // meta.json doesn't exist
    });
    mockReadDir.mockResolvedValue([
      {
        name: "2024-broken-paper",
        isDirectory: true,
        isFile: false,
        isSymlink: false,
      },
    ]);
    mockReadTextFile.mockRejectedValue(new Error("File not found"));

    const result = await listAllItems("/workspace");

    expect(result.papers).toHaveLength(0);
    expect(result.markdowns).toHaveLength(0);
  });

  it("handles unreadable markdown files gracefully", async () => {
    mockPathExists.mockResolvedValue(true);
    mockReadDir.mockResolvedValue([
      { name: "broken.md", isDirectory: false, isFile: true, isSymlink: false },
    ]);
    mockReadTextFile.mockRejectedValue(new Error("Permission denied"));

    const result = await listAllItems("/workspace");

    expect(result.papers).toHaveLength(0);
    expect(result.markdowns).toHaveLength(0);
  });

  it("sorts papers by year descending, then title ascending", async () => {
    mockPathExists.mockResolvedValue(true);
    mockReadDir.mockResolvedValue([
      {
        name: "2022-zebra-paper",
        isDirectory: true,
        isFile: false,
        isSymlink: false,
      },
      {
        name: "2024-alpha-paper",
        isDirectory: true,
        isFile: false,
        isSymlink: false,
      },
      {
        name: "2024-beta-paper",
        isDirectory: true,
        isFile: false,
        isSymlink: false,
      },
    ]);

    mockReadTextFile
      .mockResolvedValueOnce(
        JSON.stringify({
          type: "article",
          title: "Zebra Paper",
          authors: [],
          year: 2022,
          doi: null,
          abstract: null,
          keywords: null,
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          type: "article",
          title: "Alpha Paper",
          authors: [],
          year: 2024,
          doi: null,
          abstract: null,
          keywords: null,
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          type: "article",
          title: "Beta Paper",
          authors: [],
          year: 2024,
          doi: null,
          abstract: null,
          keywords: null,
        }),
      );

    mockStat.mockResolvedValue(mockFileInfo(1000, new Date("2024-01-01")));

    const result = await listAllItems("/workspace");

    expect(result.papers).toHaveLength(3);
    // 2024 papers first (alphabetically), then 2022
    expect(result.papers[0].title).toBe("Alpha Paper");
    expect(result.papers[1].title).toBe("Beta Paper");
    expect(result.papers[2].title).toBe("Zebra Paper");
  });

  it("sorts markdowns by modification date descending, then title ascending", async () => {
    mockPathExists.mockResolvedValue(true);
    mockReadDir.mockResolvedValue([
      {
        name: "old-notes.md",
        isDirectory: false,
        isFile: true,
        isSymlink: false,
      },
      {
        name: "alpha-notes.md",
        isDirectory: false,
        isFile: true,
        isSymlink: false,
      },
      {
        name: "beta-notes.md",
        isDirectory: false,
        isFile: true,
        isSymlink: false,
      },
    ]);

    mockReadTextFile.mockResolvedValueOnce(`---
title: Old Notes
---`).mockResolvedValueOnce(`---
title: Alpha Notes
---`).mockResolvedValueOnce(`---
title: Beta Notes
---`);

    mockStat
      .mockResolvedValueOnce(mockFileInfo(100, new Date("2023-01-01")))
      .mockResolvedValueOnce(mockFileInfo(100, new Date("2024-06-01")))
      .mockResolvedValueOnce(mockFileInfo(100, new Date("2024-06-01")));

    const result = await listAllItems("/workspace");

    expect(result.markdowns).toHaveLength(3);
    // Same date (2024-06-01) alphabetically first, then older date
    expect(result.markdowns[0].title).toBe("Alpha Notes");
    expect(result.markdowns[1].title).toBe("Beta Notes");
    expect(result.markdowns[2].title).toBe("Old Notes");
  });

  it("handles deeply nested folder structures", async () => {
    mockPathExists.mockResolvedValue(true);

    // Root level
    mockReadDir.mockResolvedValueOnce([
      { name: "research", isDirectory: true, isFile: false, isSymlink: false },
    ]);

    // research folder
    mockReadDir.mockResolvedValueOnce([
      { name: "ML", isDirectory: true, isFile: false, isSymlink: false },
    ]);

    // ML folder
    mockReadDir.mockResolvedValueOnce([
      {
        name: "transformers",
        isDirectory: true,
        isFile: false,
        isSymlink: false,
      },
    ]);

    // transformers folder
    mockReadDir.mockResolvedValueOnce([
      {
        name: "2024-deep-paper",
        isDirectory: true,
        isFile: false,
        isSymlink: false,
      },
      { name: "notes.md", isDirectory: false, isFile: true, isSymlink: false },
    ]);

    mockReadTextFile.mockResolvedValueOnce(
      JSON.stringify({
        type: "article",
        title: "Deep Paper",
        authors: [{ given: "Deep", family: "Author" }],
        year: 2024,
        doi: null,
        abstract: null,
        keywords: null,
      }),
    ).mockResolvedValueOnce(`---
title: Transformer Notes
---`);

    mockStat.mockResolvedValue(mockFileInfo(1000, new Date("2024-01-01")));

    const result = await listAllItems("/workspace");

    expect(result.papers).toHaveLength(1);
    expect(result.papers[0].title).toBe("Deep Paper");
    expect(result.papers[0].displayPath).toBe("/research/ML/transformers");

    expect(result.markdowns).toHaveLength(1);
    expect(result.markdowns[0].title).toBe("Transformer Notes");
    expect(result.markdowns[0].displayPath).toBe("/research/ML/transformers");
  });

  it("includes type field in search items", async () => {
    mockPathExists.mockResolvedValue(true);
    mockReadDir.mockResolvedValue([
      {
        name: "2024-paper",
        isDirectory: true,
        isFile: false,
        isSymlink: false,
      },
      { name: "notes.md", isDirectory: false, isFile: true, isSymlink: false },
    ]);

    mockReadTextFile.mockResolvedValueOnce(
      JSON.stringify({
        type: "article",
        title: "A Paper",
        authors: [],
        year: 2024,
        doi: null,
        abstract: null,
        keywords: null,
      }),
    ).mockResolvedValueOnce(`---
title: Some Notes
---`);

    mockStat.mockResolvedValue(mockFileInfo(1000, new Date("2024-01-01")));

    const result = await listAllItems("/workspace");

    expect(result.papers[0].type).toBe("paper");
    expect(result.markdowns[0].type).toBe("markdown");
  });

  it("extracts title from H1 heading when frontmatter title is missing", async () => {
    mockPathExists.mockResolvedValue(true);
    mockReadDir.mockResolvedValue([
      { name: "simple.md", isDirectory: false, isFile: true, isSymlink: false },
    ]);
    mockReadTextFile.mockResolvedValue(`# My Heading Title

Some content without frontmatter.
`);
    mockStat.mockResolvedValue(mockFileInfo(100, new Date("2024-01-01")));

    const result = await listAllItems("/workspace");

    expect(result.markdowns).toHaveLength(1);
    expect(result.markdowns[0].title).toBe("My Heading Title");
  });

  it("uses filename as title fallback when no title is found", async () => {
    mockPathExists.mockResolvedValue(true);
    mockReadDir.mockResolvedValue([
      {
        name: "untitled-notes.md",
        isDirectory: false,
        isFile: true,
        isSymlink: false,
      },
    ]);
    mockReadTextFile.mockResolvedValue(`Just some content without any title.`);
    mockStat.mockResolvedValue(mockFileInfo(100, new Date("2024-01-01")));

    const result = await listAllItems("/workspace");

    expect(result.markdowns).toHaveLength(1);
    expect(result.markdowns[0].title).toBe("untitled-notes");
  });
});
