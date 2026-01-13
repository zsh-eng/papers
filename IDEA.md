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

## Directory Structure

All items live in `$APPDIR/papers/`. Each processed PDF produces:

```
paper-name/
├── meta.json       # Bibliographic metadata (Zotero-compatible)
├── source.pdf      # Original PDF file
├── content.md      # Extracted markdown
├── content.html    # Pre-rendered HTML (app loads this directly)
├── notes.md        # User's notes (created manually or by agent)
└── figures/        # Extracted figures from the PDF that are linked to in the markdown
    ├── fig_1.png
    └── fig_2.png
```

## CLI Tool

The extraction CLI processes PDFs and outputs structured data.

### Location

```bash
bun run scripts/extract-cli.ts
```

### Commands

```bash
# Extract metadata only (fast, ~3-8 seconds)
bun run scripts/extract-cli.ts metadata <pdf>

# Extract content + render HTML (slow, ~30-200 seconds)
bun run scripts/extract-cli.ts content <pdf>

# Full pipeline: metadata + content + HTML
bun run scripts/extract-cli.ts full <pdf>
```

### Options

| Option                   | Description                                      |
| ------------------------ | ------------------------------------------------ |
| `--output-dir, -o <dir>` | Output directory (default: same as PDF)          |
| `--context, -c <text>`   | Additional context (citation, course info, etc.) |
| `--skip-figures`         | Skip figure bounding box extraction              |

### Examples

```bash
# Basic extraction
bun run scripts/extract-cli.ts full paper.pdf

# With output directory
bun run scripts/extract-cli.ts full paper.pdf -o ~/papers/attention-paper/

# With citation context (for book chapters, course readings, etc.)
bun run scripts/extract-cli.ts full chapter.pdf \
  --context "Smith, J. (2020). Chapter 3: Neural Networks. In Introduction to ML (pp. 45-67). MIT Press."

# Batch processing with context for each
bun run scripts/extract-cli.ts full reading1.pdf -c "Week 1: Johnson (2019), pp. 1-25"
bun run scripts/extract-cli.ts full reading2.pdf -c "Week 1: Chen et al. (2021), Chapter 2"
```

### Environment

```bash
export GEMINI_API_KEY=your_key  # Required
```

## Metadata Fields

The `meta.json` file contains Zotero-compatible bibliographic data:

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

### Processing Metadata

- `extractedAt`: ISO timestamp
- `providedContext`: User-provided context string

## Common Agent Tasks

### 1. Process a single paper

```bash
bun run scripts/extract-cli.ts full /path/to/paper.pdf -o ~/papers/paper-name/
cp /path/to/paper.pdf ~/papers/paper-name/source.pdf
```

### 2. Process course readings with syllabus

Given a syllabus with citations, process each reading:

```bash
# For each reading in syllabus:
bun run scripts/extract-cli.ts full reading.pdf \
  -o ~/papers/course-name/week-N/ \
  -c "Full APA citation from syllabus"
```

### 3. Add notes to a paper

Write to `~/papers/paper-name/notes.md`

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
