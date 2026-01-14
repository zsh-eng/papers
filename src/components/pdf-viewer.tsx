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

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const DEFAULT_ZOOM = 1;
const KEYBOARD_ZOOM_STEP = 0.25;
const RENDER_DEBOUNCE_MS = 150;

export function PdfViewer({
  pdfPath,
  className,
  scrollContainerRef,
}: PdfViewerProps) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(DEFAULT_ZOOM);
  // renderScale is the scale at which canvases are actually rendered
  // We use CSS transform for smooth zooming, then re-render when zooming stops
  const [renderScale, setRenderScale] = useState(DEFAULT_ZOOM);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderingRef = useRef<Set<number>>(new Set());
  const renderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Store base dimensions (at scale=1) for each page to calculate CSS-transformed sizes
  const [pageDimensions, setPageDimensions] = useState<
    Map<number, { width: number; height: number }>
  >(new Map());

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

  // Render a single page to canvas at the current renderScale
  const renderPage = useCallback(
    async (pageNum: number, canvas: HTMLCanvasElement) => {
      if (!pdf || renderingRef.current.has(pageNum)) return;

      renderingRef.current.add(pageNum);

      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: renderScale });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Store base dimensions (at scale=1) for layout calculations
        const baseViewport = page.getViewport({ scale: 1 });
        setPageDimensions((prev) => {
          const next = new Map(prev);
          next.set(pageNum, {
            width: baseViewport.width,
            height: baseViewport.height,
          });
          return next;
        });

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
    [pdf, renderScale],
  );

  // Debounce render scale updates for smooth zooming
  useEffect(() => {
    if (renderDebounceRef.current) {
      clearTimeout(renderDebounceRef.current);
    }

    renderDebounceRef.current = setTimeout(() => {
      setRenderScale(scale);
    }, RENDER_DEBOUNCE_MS);

    return () => {
      if (renderDebounceRef.current) {
        clearTimeout(renderDebounceRef.current);
      }
    };
  }, [scale]);

  // Re-render all pages when renderScale changes
  useEffect(() => {
    if (!pdf) return;

    canvasRefs.current.forEach((canvas, pageNum) => {
      renderPage(pageNum, canvas);
    });
  }, [pdf, renderScale, renderPage]);

  // CSS transform ratio for smooth zooming
  const cssScale = scale / renderScale;

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
    setScale((s) => Math.min(s + KEYBOARD_ZOOM_STEP, MAX_ZOOM));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(s - KEYBOARD_ZOOM_STEP, MIN_ZOOM));
  }, []);

  const adjustZoom = useCallback((delta: number) => {
    setScale((s) => Math.min(Math.max(s + delta, MIN_ZOOM), MAX_ZOOM));
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
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
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

  // Pinch-to-zoom via trackpad (wheel events with ctrlKey)
  useEffect(() => {
    const scrollContainer = scrollContainerRef?.current || containerRef.current;
    if (!scrollContainer) return;

    const handleWheel = (e: WheelEvent) => {
      // Pinch-to-zoom on macOS sends wheel events with ctrlKey
      if (e.ctrlKey) {
        e.preventDefault();
        // Scale the delta for smooth zooming - negative deltaY = zoom in
        const zoomSensitivity = 0.01;
        const delta = -e.deltaY * zoomSensitivity;
        adjustZoom(delta);
      }
    };

    scrollContainer.addEventListener("wheel", handleWheel, { passive: false });
    return () => scrollContainer.removeEventListener("wheel", handleWheel);
  }, [scrollContainerRef, adjustZoom, isLoading]);

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
            disabled={scale <= MIN_ZOOM}
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
            disabled={scale >= MAX_ZOOM}
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
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
            const baseDims = pageDimensions.get(pageNum);
            return (
              <div
                key={pageNum}
                className="flex items-center justify-center shrink-0"
                style={{
                  // Reserve space based on target scale using base dimensions
                  // This prevents layout shifts during CSS transform zooming
                  width: baseDims ? baseDims.width * scale : undefined,
                  height: baseDims ? baseDims.height * scale : undefined,
                }}
              >
                <canvas
                  ref={(el) => {
                    if (el) {
                      canvasRefs.current.set(pageNum, el);
                      renderPage(pageNum, el);
                    } else {
                      canvasRefs.current.delete(pageNum);
                    }
                  }}
                  className="shadow-lg bg-white"
                  style={{
                    transform: `scale(${cssScale})`,
                    transformOrigin: "center center",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
