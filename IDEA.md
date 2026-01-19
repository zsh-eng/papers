# Papers - Agent Instructions

This document provides instructions for AI agents (Claude Code, etc.) working with the Papers app.

## Overview

Papers is a research paper viewer and organizer. The app itself is a **read-only viewer** - all PDF processing is done via CLI tools that agents can invoke.

## Architecture

```
User downloads PDF
       ↓
Agent runs extraction CLI
       ↓
Output files written to library
       ↓
User views in Papers app
```

### Extraction Pipeline

The extraction happens in two phases:

1. **Metadata + Figures** (Phase 1): Extracts bibliographic metadata and figure bounding boxes using structured output. This is relatively fast (~5-15 seconds).

2. **Content** (Phase 2): Converts the PDF to markdown. Returns plain text (no JSON schema) to maximize extraction quality. Slower (~30-200 seconds depending on length).

This separation allows the content extraction model to focus entirely on accurate text conversion without also tracking figure coordinates.

## Directory Structure

All items live in `$APPDIR/papers/`. Each processed PDF produces:

```
paper-name/         # year-name (if year is present) e.g. 2017-attention-is-all-you-need or cs4223-l3-cache-coherence
├── meta.json       # Bibliographic metadata + figure bounding boxes
├── source.pdf      # Original PDF file
├── content.md      # Extracted markdown
├── content.html    # Pre-rendered HTML (app loads this directly)
├── notes.md        # User's notes (created manually or by agent)
└── figures/        # Extracted figures from the PDF
    ├── fig_1.png
    └── fig_2.png
```

## CLI Tool

The extraction CLI processes PDFs and outputs structured data. It automatically creates a folder named `{year}-{title-slug}` for each paper.

### Location

```bash
bun run scripts/extract-cli.ts
```

### Commands

```bash
# Full pipeline (recommended): metadata + content + HTML
bun run scripts/extract-cli.ts full <pdf>

# Extract metadata only (~5-15 seconds)
bun run scripts/extract-cli.ts metadata <pdf>

# Extract content only (requires metadata first)
bun run scripts/extract-cli.ts content <pdf>
```

### Options

| Option                   | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| `--output-dir, -o <dir>` | Parent directory for paper folder (default: same as PDF) |
| `--context, -c <text>`   | Additional context (citation, course info, etc.)         |

### Examples

```bash
# Process into ~/papers/2017-attention-is-all-you-need/
bun run scripts/extract-cli.ts full attention.pdf -o ~/papers

# Organize by topic: ~/papers/ml/2017-attention-is-all-you-need/
bun run scripts/extract-cli.ts full attention.pdf -o ~/papers/ml

# With citation context (for book chapters, course readings, etc.)
bun run scripts/extract-cli.ts full chapter.pdf -o ~/papers \
  --context "Smith, J. (2020). Chapter 3: Neural Networks. In Introduction to ML (pp. 45-67). MIT Press."

# Batch processing with context
bun run scripts/extract-cli.ts full reading1.pdf -o ~/papers/course -c "Week 1: Johnson (2019)"
bun run scripts/extract-cli.ts full reading2.pdf -o ~/papers/course -c "Week 1: Chen et al. (2021)"
```

### Environment

```bash
export GEMINI_API_KEY=your_key  # Required
```

## Metadata Fields

The `meta.json` file contains Zotero-compatible bibliographic data plus figure information.

### Core Fields (always present)

- `type`: article | book | chapter | conference | thesis | report | slides | document
- `title`: Document title
- `authors`: Array of `{given, family}` objects
- `year`: Publication year
- `pageCount`: Number of pages

### Identifiers

- `doi`: DOI (e.g., "10.1234/example")
- `url`: URL if no DOI
- `isbn`: ISBN for books

### Article Fields

- `journal`: Journal name
- `volume`, `issue`, `pages`: Publication details

### Book/Chapter Fields

- `bookTitle`: Parent book (for chapters)
- `publisher`: Publisher name
- `edition`: Edition number
- `editors`: Array of editor names

### Conference Fields

- `conference`: Conference/venue name

### Content

- `abstract`: Abstract text
- `keywords`: Array of keywords

### Figures

- `figures`: Array of figure objects with:
  - `id`: Unique identifier (e.g., "fig_1")
  - `page`: Page number (0-indexed)
  - `bbox`: Bounding box [x1, y1, x2, y2] in PDF points
  - `caption`: Caption text if found

### Processing Metadata

- `extractedAt`: ISO timestamp
- `providedContext`: User-provided context string

## Common Agent Tasks

### 1. Process a single paper

```bash
# Folder is auto-created as ~/papers/2017-attention-is-all-you-need/
bun run scripts/extract-cli.ts full /path/to/attention.pdf -o ~/papers
```

### 2. Process course readings with syllabus

Given a syllabus with citations, process each reading:

```bash
# Each reading gets its own auto-named folder in ~/papers/cs229/
bun run scripts/extract-cli.ts full reading1.pdf -o ~/papers/cs229 -c "Week 1: Johnson (2019)"
bun run scripts/extract-cli.ts full reading2.pdf -o ~/papers/cs229 -c "Week 1: Chen et al. (2021)"
```

### 3. Add notes to a paper

Write to `~/papers/{paper-folder}/notes.md`

### 4. Search the library

```bash
# Find by title
grep -r "attention" ~/papers/*/meta.json

# Find by author
grep -r "Vaswani" ~/papers/*/meta.json

# Full text search
rg "transformer architecture" ~/papers/
```

### 5. List all papers by type

```bash
grep -l '"type": "article"' ~/papers/*/meta.json
grep -l '"type": "conference"' ~/papers/*/meta.json
```

## Notes

- The app is a viewer only - it reads `content.html` directly
- Processing is intentionally manual/agent-driven for flexibility
- Use `--context` to provide information not in the PDF (citations, course info)
- Figure extraction spawns a subprocess and uses pdftocairo for the extraction
- The content extraction uses plain text output (no JSON schema) to maximize quality
