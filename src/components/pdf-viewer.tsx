import { cn } from "@/lib/utils";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface PdfViewerProps {
  pdfPath: string;
  className?: string;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const DEFAULT_ZOOM_INDEX = 2; // 100%

export function PdfViewer({
  pdfPath,
  className,
  scrollContainerRef,
}: PdfViewerProps) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderingRef = useRef<Set<number>>(new Set());

  const scale = ZOOM_LEVELS[zoomIndex];

  // Load PDF document
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setIsLoading(true);
      setError(null);

      try {
        // Convert file path to asset URL for Tauri
        const url = convertFileSrc(pdfPath);
        const loadingTask = pdfjsLib.getDocument(url);
        const pdfDoc = await loadingTask.promise;

        if (cancelled) return;

        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.error("Failed to load PDF:", err);
        if (!cancelled) {
          setError("Failed to load PDF file");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [pdfPath]);

  // Render a single page to canvas
  const renderPage = useCallback(
    async (pageNum: number, canvas: HTMLCanvasElement) => {
      if (!pdf || renderingRef.current.has(pageNum)) return;

      renderingRef.current.add(pageNum);

      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const context = canvas.getContext("2d");
        if (!context) return;

        await page.render({
          canvasContext: context,
          canvas: canvas,
          viewport,
        }).promise;
      } catch (err) {
        console.error(`Failed to render page ${pageNum}:`, err);
      } finally {
        renderingRef.current.delete(pageNum);
      }
    },
    [pdf, scale],
  );

  // Re-render all visible pages when scale changes
  useEffect(() => {
    if (!pdf) return;

    canvasRefs.current.forEach((canvas, pageNum) => {
      renderPage(pageNum, canvas);
    });
  }, [pdf, scale, renderPage]);

  // Track current page based on scroll position
  useEffect(() => {
    const scrollContainer = scrollContainerRef?.current || containerRef.current;
    if (!scrollContainer || numPages === 0) return;

    const handleScroll = () => {
      const canvases = Array.from(canvasRefs.current.entries());
      const containerRect = scrollContainer.getBoundingClientRect();
      const containerMiddle = containerRect.top + containerRect.height / 2;

      for (const [pageNum, canvas] of canvases) {
        const rect = canvas.getBoundingClientRect();
        if (rect.top <= containerMiddle && rect.bottom >= containerMiddle) {
          setCurrentPage(pageNum);
          break;
        }
      }
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [numPages, scrollContainerRef]);

  // Scroll to page
  const scrollToPage = useCallback(
    (pageNum: number) => {
      const canvas = canvasRefs.current.get(pageNum);
      const scrollContainer =
        scrollContainerRef?.current || containerRef.current;
      if (!canvas || !scrollContainer) return;

      const containerRect = scrollContainer.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const scrollTop =
        scrollContainer.scrollTop + (canvasRect.top - containerRect.top) - 16; // 16px padding

      scrollContainer.scrollTo({ top: scrollTop, behavior: "smooth" });
      setCurrentPage(pageNum);
    },
    [scrollContainerRef],
  );

  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) {
      scrollToPage(currentPage - 1);
    }
  }, [currentPage, scrollToPage]);

  const goToNextPage = useCallback(() => {
    if (currentPage < numPages) {
      scrollToPage(currentPage + 1);
    }
  }, [currentPage, numPages, scrollToPage]);

  const zoomIn = useCallback(() => {
    setZoomIndex((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomIndex((i) => Math.max(i - 1, 0));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if input is focused
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goToNextPage();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "=") {
        e.preventDefault();
        zoomIn();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault();
        zoomOut();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrevPage, goToNextPage, zoomIn, zoomOut]);

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-full text-muted-foreground",
          className,
        )}
      >
        <div className="animate-pulse">Loading PDF...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-full text-destructive",
          className,
        )}
      >
        {error}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Controls bar - positioned at top within container */}
      <div className="sticky top-0 z-10 flex items-center justify-center gap-4 py-2 px-4 border-b border-border bg-muted">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            className="p-1 rounded hover:bg-muted-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-muted-foreground min-w-[4rem] text-center">
            {currentPage} / {numPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={currentPage >= numPages}
            className="p-1 rounded hover:bg-muted-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={zoomIndex <= 0}
            className="p-1 rounded hover:bg-muted-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Zoom out"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
            className="p-1 rounded hover:bg-muted-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Zoom in"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF pages container - scrollable both directions */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-muted/20">
        <div className="flex flex-col items-center gap-4 p-4 min-w-fit">
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <canvas
              key={pageNum}
              ref={(el) => {
                if (el) {
                  canvasRefs.current.set(pageNum, el);
                  renderPage(pageNum, el);
                } else {
                  canvasRefs.current.delete(pageNum);
                }
              }}
              className="shadow-lg bg-white"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
