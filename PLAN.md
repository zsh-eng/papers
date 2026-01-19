Implementation Plan: Papers (Desktop)
Overview
A Tauri desktop app for reading, annotating, and taking notes on research papers. Filesystem is the source of truth. Agent-friendly by design.

---

Phase 1: Project Foundation
1.1 Initialize Tauri + React Project

- Tauri v2 with React + TypeScript
- Tailwind CSS + shadcn/ui
- Directory structure:
  paperstack/
  ├── src-tauri/ # Rust backend
  ├── src/ # React frontend
  │ ├── components/
  │ ├── hooks/
  │ ├── lib/
  │ └── pages/
  ├── scripts/ # Python parsing scripts (copy from current project)
  └── package.json
  1.2 Workspace Configuration
- On first launch, prompt user to select a workspace folder (e.g., ~/research)
- Store workspace path in Tauri's app data directory
- Support multiple workspaces (future, but design for it)
  1.3 Workspace Structure Convention
  $APPDIR/ # User-selected workspace
  ├── AGENTS.md # Agent context (conventions, recent activity)
  ├── papers/
  │ └── {hash}-{year}-{slug}/
  │ ├── index.pdf # Original PDF
  │ ├── content.md # Parsed markdown with frontmatter
  │ ├── figures/ # Extracted figures
  │ ├── notes.md # User's notes on this paper
  │ └── annotations.json # Highlight metadata
  └── projects/
  └── {project-name}/
  └── \*.md # Project documents

---

Phase 2: Core Paper Management
2.1 Paper Import Flow

1. User drags PDF or clicks "Import"
2. Compute xxHash of file → check for duplicates
3. Extract metadata via Gemini (title, authors, year, DOI) - extend extract_unified.py
4. Generate folder name: {hash_prefix}-{year}-{slug}
5. Copy PDF to papers/{folder}/index.pdf
6. Run parsing pipeline: uv run extract_unified.py
7. Save content.md with frontmatter
   2.2 Paper Library View

- List all papers from papers/ directory
- Show: title, authors, year, tags (from frontmatter)
- Search via ripgrep (full-text across all content.md and notes.md)
- Sort by: date added, year, title
  2.3 File Watching
- Use Tauri's notify for filesystem events
- Auto-refresh library when files change (external edits, sync)

---

Phase 3: Reading Experience
3.1 Markdown Viewer

- Render content.md with custom components:
  - Figures: ![caption](figures/fig_1.png) → clickable, zoomable
  - Math: KaTeX for LaTeX rendering
  - Tables: Proper table styling
- Typography optimized for reading (line height, max-width, font choice)
  3.2 PDF Viewer (Side Panel)
- PDF.js integration for viewing original PDF
- Useful for: checking figures, scanned documents, verifying parsing
- Toggle between markdown view and PDF view
  3.3 Split View
- Left: content.md (reading)
- Right: notes.md (writing)
- Resizable panes

---

Phase 4: Annotations & Highlighting
4.1 Highlight Creation

- User selects text in markdown view → highlight menu appears
- Choose color (yellow, green, blue, red, purple)
- Optionally add a note
- Generate nanoid for highlight: h_7x9k2m
  4.2 Annotation Storage (annotations.json)
  {
  version: 1,
  highlights: [
  {
  id: h_7x9k2m,
  text: multi-head attention mechanism,
  anchor: {
  textBefore: We propose a new ,
  textAfter: that allows the model,
  sectionHeading: ## 3. Model Architecture
  },
  color: yellow,
  note: Key innovation - allows parallel attention,
  createdAt: 2025-01-11T10:30:00Z,
  updatedAt: 2025-01-11T10:30:00Z
  }
  ]
  }
  4.3 Highlight Rendering
- On load, match highlights to text using anchors
- Render as <mark> with appropriate color
- Show note indicator (small icon) if highlight has a note
- Click highlight → show note popover
  4.4 Highlight Anchoring Strategy
- Primary: textBefore + text + textAfter (fuzzy match)
- Secondary: sectionHeading + character offset (fallback)
- If match fails, show "orphaned highlight" indicator

---

Phase 5: Note-Taking & Editor
5.1 CodeMirror 6 Integration

- Markdown editing with live preview toggle
- Vim mode (optional, user preference)
- Custom extensions:
  - @ trigger for paper/highlight autocomplete
  - Syntax highlighting for [@paper#highlight] links
    5.2 @ Mention System
    User types: @att
    UI shows: Autocomplete dropdown with matching papers
    User selects: "Attention Is All You Need (2017)"
    Inserted markdown: [@a3f2-2017-attention]
    Rendered in preview: "Attention Is All You Need" (clickable)
    User types: @a3f2-2017-attention#
    UI shows: List of highlights from that paper
    User selects: highlight "multi-head attention mechanism"
    Inserted markdown: [@a3f2-2017-attention#h_7x9k2m]
    Rendered in preview: "multi-head attention mechanism" (clickable, shows context on hover)
    5.3 Link Syntax (Underlying Representation)
    <!-- In notes.md or project docs -->
    The [@a3f2-2017-attention] paper introduced [@a3f2-2017-attention#h_7x9k2m].
    <!-- With custom display text -->
    [@a3f2-2017-attention|Vaswani et al., 2017] showed that...
    5.4 Link Resolution
- [@{paper-id}] → resolve to papers/{paper-id}/
- [@{paper-id}#h_{id}] → resolve to specific highlight in annotations.json
- Clicking navigates to paper/highlight
- Hover shows preview (paper metadata or highlight context)

---

Phase 6: Projects
6.1 Projects List

- Show folders from projects/
- Each project can have multiple markdown files
  6.2 Project Documents
- Same editor as notes.md
- Same @ mention system works for referencing papers/highlights
- Backlinks panel: "Papers referenced in this document"

---

Phase 7: Search
7.1 Global Search

- Invoke ripgrep via Tauri shell command
- Search across: content.md, notes.md, projects/\*_/_.md
- Show results with context snippets
- Click result → navigate to file and line
  7.2 Paper-Scoped Search
- Search within current paper's content.md
- Cmd+F style find-in-document

---

Phase 8: Agent Integration
8.1 AGENTS.md

- Auto-maintained file at workspace root
- Contains:
  - Workspace structure conventions
  - Recent papers added/modified
  - Current project being worked on
- Updated by app on significant actions
  8.2 Agent-Friendly Design
- All data in human-readable files (markdown, JSON)
- Agents can: read papers, add notes, create highlights, search via ripgrep
- No database to query - just filesystem operations

---

Future Considerations (Not in Initial Scope)
| Feature | Notes |
|---------|-------|
| In-PDF annotations | PDF.js annotation layer, store in separate pdf-annotations.json, sync with highlight system |
| PPTX support | Convert via unoconv or similar → PDF → standard pipeline |
| Mobile | Defer until Tauri Mobile matures or build separate React Native app with sync |
| Collaboration | Would require sync infrastructure |
| Citation export | Export to BibTeX, formatted citations |
| Zotero import | Import existing Zotero library |

---

Tech Stack Summary
| Layer | Technology |
|-------|------------|
| Desktop framework | Tauri v2 |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Editor | CodeMirror 6 + vim mode + custom extensions |
| Markdown rendering | react-markdown + remark-gfm + rehype-katex |
| PDF viewing | PDF.js (react-pdf) |
| Parsing | Python (existing extract_unified.py) via uv run |
| Search | ripgrep via Tauri shell |
| File watching | Tauri notify |
| IDs | nanoid |
| Hashing | xxhash (for deduplication) |

---

Proposed Build Order

1. Phase 1: Foundation (Tauri + React + workspace setup) - ~2-3 days
2. Phase 2: Paper import + library view - ~3-4 days
3. Phase 3: Markdown viewer + PDF viewer - ~3-4 days
4. Phase 5: Editor (CodeMirror) + basic notes - ~2-3 days
5. Phase 4: Annotations system - ~3-4 days
6. Phase 7: Search integration - ~1-2 days
7. Phase 6: Projects - ~2 days
8. Phase 8: Agent integration - ~1 day
   Estimated total: ~3-4 weeks for MVP

---

Questions Before Proceeding

1. Parsing metadata: Your current extract_unified.py doesn't extract structured metadata (title, authors, year). Should I extend it to do so, or is that a separate script?
2. App name: I've been calling it "PaperStack" as a placeholder. Do you have a preferred name?
3. Keyboard shortcuts: Any specific shortcuts you want? (e.g., Cmd+O for open paper, Cmd+P for quick switcher like VS Code)
4. Theme: Light mode only, dark mode only, or system preference toggle?
5. Where should this project live? New directory alongside pdf-extraction-comparison, or should I scaffold it inside a subdirectory here?
