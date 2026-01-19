// Color definitions
export const HIGHLIGHT_COLORS = [
  { name: "yellow" },
  { name: "green" },
  { name: "blue" },
  { name: "magenta" },
] as const;

export const ANNOTATION_COLORS = [
  ...HIGHLIGHT_COLORS,
  { name: "invisible" }, // for note-only annotations
] as const;

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]["name"];
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number]["name"];

// Position data for HTML highlights (compatible with @zsh-eng/text-highlighter)
export interface TextPosition {
  startOffset: number;
  endOffset: number;
  selectedText: string;
  textBefore?: string;
  textAfter?: string;
}

// Position data for PDF annotations (future)
export interface PdfPosition {
  page: number;
  rects: Array<[number, number, number, number]>; // [x1, y1, x2, y2]
  selectedText?: string;
}

// Base fields shared by all annotations
interface BaseAnnotation {
  id: string;
  color: AnnotationColor;
  note?: string; // Attached note/comment (like Zotero)
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

// Discriminated union
export interface HtmlAnnotation extends BaseAnnotation {
  source: "html";
  position: TextPosition;
}

export interface PdfAnnotation extends BaseAnnotation {
  source: "pdf";
  position: PdfPosition;
}

export type Annotation = HtmlAnnotation | PdfAnnotation;

// File schema
export const ANNOTATIONS_SCHEMA_VERSION = 1;

export interface AnnotationsFile {
  version: typeof ANNOTATIONS_SCHEMA_VERSION;
  annotations: Annotation[];
}

// Type guards
export function isHtmlAnnotation(ann: Annotation): ann is HtmlAnnotation {
  return ann.source === "html";
}

export function isPdfAnnotation(ann: Annotation): ann is PdfAnnotation {
  return ann.source === "pdf";
}
