import { describe, expect, it } from "vitest";
import {
  extractAuthor,
  extractTitle,
  parseMarkdown,
  type ParsedMarkdown,
} from "./markdown";

describe("parseMarkdown", () => {
  describe("frontmatter extraction", () => {
    it("parses simple key-value frontmatter", () => {
      const content = `---
title: My Document
author: John Doe
---

# Content here`;

      const result = parseMarkdown(content);

      expect(result.data.title).toBe("My Document");
      expect(result.data.author).toBe("John Doe");
      expect(result.content).toBe("# Content here");
    });

    it("parses quoted string values", () => {
      const content = `---
title: "A title with: colons"
subtitle: 'Single quoted value'
---

Body`;

      const result = parseMarkdown(content);

      expect(result.data.title).toBe("A title with: colons");
      expect(result.data.subtitle).toBe("Single quoted value");
    });

    it("parses numeric values", () => {
      const content = `---
year: 2024
rating: 4.5
negative: -10
---`;

      const result = parseMarkdown(content);

      expect(result.data.year).toBe(2024);
      expect(result.data.rating).toBe(4.5);
      expect(result.data.negative).toBe(-10);
    });

    it("parses boolean values", () => {
      const content = `---
published: true
draft: false
---`;

      const result = parseMarkdown(content);

      expect(result.data.published).toBe(true);
      expect(result.data.draft).toBe(false);
    });

    it("parses null values", () => {
      const content = `---
description: null
---`;

      const result = parseMarkdown(content);

      expect(result.data.description).toBe(null);
    });

    it("skips comments in frontmatter", () => {
      const content = `---
title: Test
# This is a comment
author: Jane
---`;

      const result = parseMarkdown(content);

      expect(result.data.title).toBe("Test");
      expect(result.data.author).toBe("Jane");
      expect(Object.keys(result.data)).toHaveLength(2);
    });

    it("skips empty lines in frontmatter", () => {
      const content = `---
title: Test

author: Jane
---`;

      const result = parseMarkdown(content);

      expect(result.data.title).toBe("Test");
      expect(result.data.author).toBe("Jane");
    });

    it("handles values with colons", () => {
      const content = `---
url: https://example.com
time: 10:30:00
---`;

      const result = parseMarkdown(content);

      expect(result.data.url).toBe("https://example.com");
      expect(result.data.time).toBe("10:30:00");
    });
  });

  describe("edge cases", () => {
    it("returns empty data when no frontmatter delimiter at start", () => {
      const content = `# No Frontmatter

Just regular markdown.`;

      const result = parseMarkdown(content);

      expect(result.data).toEqual({});
      expect(result.content).toBe(content);
    });

    it("returns empty data when frontmatter is not closed", () => {
      const content = `---
title: Unclosed
author: Someone

This looks like body but frontmatter never closed.`;

      const result = parseMarkdown(content);

      expect(result.data).toEqual({});
      expect(result.content).toBe(content);
    });

    it("returns empty data for content with less than 3 lines", () => {
      const content = `---
title: Short`;

      const result = parseMarkdown(content);

      expect(result.data).toEqual({});
      expect(result.content).toBe(content);
    });

    it("handles empty content", () => {
      const result = parseMarkdown("");

      expect(result.data).toEqual({});
      expect(result.content).toBe("");
    });

    it("handles frontmatter with only delimiters (no content)", () => {
      const content = `---
---

Body content`;

      const result = parseMarkdown(content);

      expect(result.data).toEqual({});
      expect(result.content).toBe("Body content");
    });

    it("trims leading whitespace from body content", () => {
      const content = `---
title: Test
---


Multiple blank lines before body.`;

      const result = parseMarkdown(content);

      expect(result.content).toBe("Multiple blank lines before body.");
    });

    it("handles keys without values", () => {
      const content = `---
title:
author: Valid
---`;

      const result = parseMarkdown(content);

      expect(result.data.title).toBe("");
      expect(result.data.author).toBe("Valid");
    });

    it("handles lines without colons (skips them)", () => {
      const content = `---
title: Valid
this is not a key value pair
author: Also Valid
---`;

      const result = parseMarkdown(content);

      expect(result.data.title).toBe("Valid");
      expect(result.data.author).toBe("Also Valid");
      expect(Object.keys(result.data)).toHaveLength(2);
    });

    it("handles whitespace around delimiters", () => {
      const content = `---
title: Test
  ---

Body`;

      const result = parseMarkdown(content);

      expect(result.data.title).toBe("Test");
      expect(result.content).toBe("Body");
    });
  });
});

describe("extractTitle", () => {
  it("extracts title from frontmatter", () => {
    const parsed: ParsedMarkdown = {
      data: { title: "Frontmatter Title" },
      content: "# H1 Title\n\nBody",
    };

    expect(extractTitle(parsed)).toBe("Frontmatter Title");
  });

  it("trims whitespace from frontmatter title", () => {
    const parsed: ParsedMarkdown = {
      data: { title: "  Spaced Title  " },
      content: "",
    };

    expect(extractTitle(parsed)).toBe("Spaced Title");
  });

  it("falls back to H1 heading when no frontmatter title", () => {
    const parsed: ParsedMarkdown = {
      data: {},
      content: "# My Heading\n\nSome content.",
    };

    expect(extractTitle(parsed)).toBe("My Heading");
  });

  it("extracts H1 from middle of content", () => {
    const parsed: ParsedMarkdown = {
      data: {},
      content: "Some intro text.\n\n# The Real Title\n\nMore content.",
    };

    expect(extractTitle(parsed)).toBe("The Real Title");
  });

  it("returns null when no title found", () => {
    const parsed: ParsedMarkdown = {
      data: {},
      content: "No heading here, just plain text.",
    };

    expect(extractTitle(parsed)).toBe(null);
  });

  it("returns null for empty frontmatter title", () => {
    const parsed: ParsedMarkdown = {
      data: { title: "" },
      content: "",
    };

    expect(extractTitle(parsed)).toBe(null);
  });

  it("returns null for whitespace-only frontmatter title", () => {
    const parsed: ParsedMarkdown = {
      data: { title: "   " },
      content: "",
    };

    expect(extractTitle(parsed)).toBe(null);
  });

  it("ignores H2 and lower headings", () => {
    const parsed: ParsedMarkdown = {
      data: {},
      content: "## H2 Heading\n\n### H3 Heading",
    };

    expect(extractTitle(parsed)).toBe(null);
  });

  it("trims whitespace from H1 title", () => {
    const parsed: ParsedMarkdown = {
      data: {},
      content: "#   Spaced Heading   ",
    };

    expect(extractTitle(parsed)).toBe("Spaced Heading");
  });

  it("ignores non-string title in frontmatter", () => {
    const parsed: ParsedMarkdown = {
      data: { title: 123 },
      content: "# Fallback Title",
    };

    expect(extractTitle(parsed)).toBe("Fallback Title");
  });
});

describe("extractAuthor", () => {
  it("extracts author from frontmatter", () => {
    const parsed: ParsedMarkdown = {
      data: { author: "John Doe" },
      content: "",
    };

    expect(extractAuthor(parsed)).toBe("John Doe");
  });

  it("trims whitespace from author", () => {
    const parsed: ParsedMarkdown = {
      data: { author: "  Jane Smith  " },
      content: "",
    };

    expect(extractAuthor(parsed)).toBe("Jane Smith");
  });

  it("returns undefined when no author", () => {
    const parsed: ParsedMarkdown = {
      data: {},
      content: "",
    };

    expect(extractAuthor(parsed)).toBeUndefined();
  });

  it("returns undefined for empty author", () => {
    const parsed: ParsedMarkdown = {
      data: { author: "" },
      content: "",
    };

    expect(extractAuthor(parsed)).toBeUndefined();
  });

  it("returns undefined for whitespace-only author", () => {
    const parsed: ParsedMarkdown = {
      data: { author: "   " },
      content: "",
    };

    expect(extractAuthor(parsed)).toBeUndefined();
  });

  it("returns undefined for non-string author", () => {
    const parsed: ParsedMarkdown = {
      data: { author: ["Multiple", "Authors"] },
      content: "",
    };

    expect(extractAuthor(parsed)).toBeUndefined();
  });
});
