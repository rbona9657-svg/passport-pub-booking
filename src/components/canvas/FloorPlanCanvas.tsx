"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { Stage, Layer, Rect, Line, Transformer } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type Konva from "konva";
import type { PubTable, VisualElement } from "@/types";
import TableShape from "./TableShape";
import VisualElementShape from "./VisualElementShape";
const GRID_SIZE = 20;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.15;
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

export interface ViewportCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FloorPlanCanvasProps {
  mode: "editor" | "booking";
  tables: PubTable[];
  visualElements: VisualElement[];
  tableStatuses?: Record<string, "available" | "pending" | "booked">;
  selectedTableId?: string | null;
  onTableSelect?: (tableId: string) => void;
  onLayoutChange?: (
    tables: PubTable[],
    elements: VisualElement[]
  ) => void;
  selectedEditorId?: string | null;
  onEditorSelect?: (id: string | null) => void;
  viewportCrop?: ViewportCrop | null;
}

export default function FloorPlanCanvas({
  mode,
  tables,
  visualElements,
  tableStatuses = {},
  selectedTableId,
  onTableSelect,
  onLayoutChange,
  selectedEditorId,
  onEditorSelect,
  viewportCrop,
}: FloorPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 500 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const initialFitRef = useRef<{ scale: number; position: { x: number; y: number } } | null>(null);

  // Track whether booking sizing has been applied successfully.
  // State (not ref) so the Stage is conditionally rendered — it does NOT
  // exist in the DOM until sizing succeeds, eliminating any flash of
  // unsized content. Once true, stays true (never reset on data changes).
  const [bookingSizingDone, setBookingSizingDone] = useState(false);
  const sizingDoneRef = useRef(false);

  // Keep viewportCrop in a ref so the sizing callback always reads the latest value
  const viewportCropRef = useRef(viewportCrop);
  viewportCropRef.current = viewportCrop;

  // Use refs so callbacks always have latest data
  const tablesRef = useRef(tables);
  tablesRef.current = tables;
  const elementsRef = useRef(visualElements);
  elementsRef.current = visualElements;

  // Stable sizing function (editor mode + resize handler)
  const updateSize = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.getBoundingClientRect().width;
    if (containerWidth < 50) return;

    const mobile = containerWidth < 768;
    setIsMobile(mobile);

    if (mode === "booking") {
      const crop = viewportCropRef.current;
      const allTables = tablesRef.current;
      const allElements = elementsRef.current;
      // Skip sizing if no data loaded yet — avoid rendering at wrong scale
      if (allTables.length === 0 && allElements.length === 0 && !crop) return;
      applyBookingSize(containerWidth, crop, allTables, allElements);
    } else {
      const maxH = mobile ? 500 : 700;
      const minH = 350;
      const height = Math.max(minH, Math.min(maxH, window.innerHeight - 200));
      setStageSize({ width: containerWidth, height });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- applyBookingSize is stable ([] deps)
  }, [mode]);

  // Extracted sizing logic for booking mode so it can be called from both
  // the props-driven effect and the ResizeObserver callback.
  const applyBookingSize = useCallback(
    (
      containerWidth: number,
      crop: ViewportCrop | null | undefined,
      allTables: PubTable[],
      allElements: VisualElement[]
    ) => {
      // Always compute the bounding box of actual content first
      const allItems = [
        ...allTables.map((t) => ({
          x: t.positionX,
          y: t.positionY,
          w: t.width ?? 80,
          h: t.height ?? 80,
        })),
        ...allElements.map((e) => ({
          x: e.positionX,
          y: e.positionY,
          w: e.width ?? 60,
          h: e.height ?? 60,
        })),
      ];

      if (allItems.length === 0) {
        const fitScale = containerWidth / CANVAS_WIDTH;
        setStageSize({ width: containerWidth, height: CANVAS_HEIGHT * fitScale });
        setScale(fitScale);
        setPosition({ x: 0, y: 0 });
        initialFitRef.current = { scale: fitScale, position: { x: 0, y: 0 } };
        sizingDoneRef.current = true;
        setBookingSizingDone(true);
        return;
      }

      const PADDING = 40;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const item of allItems) {
        minX = Math.min(minX, item.x);
        minY = Math.min(minY, item.y);
        maxX = Math.max(maxX, item.x + item.w);
        maxY = Math.max(maxY, item.y + item.h);
      }
      minX -= PADDING;
      minY -= PADDING;
      maxX += PADDING;
      maxY += PADDING;

      // Use the admin-defined crop when available — it reflects the intended
      // visible area regardless of how much content it contains.
      // Fall back to the content bounding box only when no crop is set.
      let effectiveX: number;
      let effectiveY: number;
      let effectiveW: number;
      let effectiveH: number;

      if (crop && crop.width > 0 && crop.height > 0) {
        effectiveX = crop.x;
        effectiveY = crop.y;
        effectiveW = crop.width;
        effectiveH = crop.height;
      } else {
        effectiveX = minX;
        effectiveY = minY;
        effectiveW = maxX - minX;
        effectiveH = maxY - minY;
      }

      const fitScale = containerWidth / effectiveW;
      const contentHeight = effectiveH * fitScale;
      let canvasHeight = contentHeight;

      // Ensure a minimum height on mobile so the floor plan isn't a thin strip
      const MIN_BOOKING_HEIGHT = 220;
      if (canvasHeight < MIN_BOOKING_HEIGHT) {
        canvasHeight = MIN_BOOKING_HEIGHT;
      }

      // Center content vertically when canvas is taller than content
      const yOffset = (canvasHeight - contentHeight) / 2;
      const pos = { x: -effectiveX * fitScale, y: -effectiveY * fitScale + yOffset };

      setStageSize({ width: containerWidth, height: canvasHeight });
      setScale(fitScale);
      setPosition(pos);
      initialFitRef.current = { scale: fitScale, position: pos };
      sizingDoneRef.current = true;
      setBookingSizingDone(true);
    },
    []
  );

  // Booking mode: robust sizing that keeps retrying until the container is
  // laid out and sizing succeeds. Uses a rAF polling loop (up to ~2s) plus
  // setTimeout fallbacks to handle all iframe timing scenarios, including
  // iOS Safari cold loads where the container may report zero width for
  // many frames after mount.
  useEffect(() => {
    if (mode !== "booking") return;
    // Don't size until we have actual floor plan data
    if (tables.length === 0 && visualElements.length === 0 && !viewportCrop) return;

    sizingDoneRef.current = false;
    let cancelled = false;
    let rafId = 0;
    let frameCount = 0;
    const MAX_RAF_FRAMES = 120; // ~2 seconds of polling at 60fps

    const attemptSizing = (): boolean => {
      if (cancelled || sizingDoneRef.current) return true;
      if (!containerRef.current) return false;
      const containerWidth = containerRef.current.getBoundingClientRect().width;
      if (containerWidth < 50) return false;
      applyBookingSize(containerWidth, viewportCrop, tables, visualElements);
      return sizingDoneRef.current;
    };

    // Strategy 1: rAF polling — keeps trying every frame until container has width
    const pollFrame = () => {
      if (cancelled || sizingDoneRef.current) return;
      frameCount++;
      if (attemptSizing()) return;
      if (frameCount < MAX_RAF_FRAMES) {
        rafId = requestAnimationFrame(pollFrame);
      }
    };
    rafId = requestAnimationFrame(pollFrame);

    // Strategy 2: setTimeout fallbacks at key intervals (in case rAF is throttled
    // in background tabs or hidden iframes on iOS)
    const timers = [
      window.setTimeout(attemptSizing, 100),
      window.setTimeout(attemptSizing, 500),
      window.setTimeout(attemptSizing, 1000),
      window.setTimeout(attemptSizing, 2000),
    ];

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      timers.forEach(clearTimeout);
    };
  }, [mode, tables, visualElements, viewportCrop, applyBookingSize]);

  // ResizeObserver for container width changes — also acts as a safety net
  // for booking mode: if sizing hasn't been done yet (e.g. container was
  // initially zero-width in an iframe), this catches the first real resize.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateSize);
      observer.observe(el);
    }

    window.addEventListener("resize", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
      observer?.disconnect();
    };
  }, [updateSize]);

  // Attach Transformer to selected editor node
  useEffect(() => {
    if (mode !== "editor" || !transformerRef.current || !stageRef.current) return;
    const tr = transformerRef.current;

    if (!selectedEditorId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }

    // Find the Group node for the selected item
    const stage = stageRef.current;
    const node = stage.findOne(`#${selectedEditorId}`);
    if (node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedEditorId, mode, tables, visualElements]);

  // Grid lines (editor only)
  const gridLines = useMemo(() => {
    if (mode === "booking") return [];
    const lines: { points: number[]; key: string }[] = [];
    const gridW = CANVAS_WIDTH * 2;
    const gridH = CANVAS_HEIGHT * 2;
    for (let x = 0; x <= gridW; x += GRID_SIZE) {
      lines.push({ points: [x, 0, x, gridH], key: `v-${x}` });
    }
    for (let y = 0; y <= gridH; y += GRID_SIZE) {
      lines.push({ points: [0, y, gridW, y], key: `h-${y}` });
    }
    return lines;
  }, [mode]);

  // Zoom with scroll wheel (editor) or pinch (booking mobile)
  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY < 0 ? 1 : -1;
      const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldScale + direction * ZOOM_STEP));

      const mousePointTo = {
        x: (pointer.x - position.x) / oldScale,
        y: (pointer.y - position.y) / oldScale,
      };

      setScale(newScale);
      setPosition({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    },
    [scale, position]
  );

  const handleDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      if (e.target === stageRef.current) {
        setPosition({ x: e.target.x(), y: e.target.y() });
      }
    },
    []
  );

  const handleTableDragEnd = useCallback(
    (tableId: string, x: number, y: number) => {
      if (!onLayoutChange) return;
      const updatedTables = tables.map((t) =>
        t.id === tableId ? { ...t, positionX: x, positionY: y } : t
      );
      onLayoutChange(updatedTables, visualElements);
    },
    [tables, visualElements, onLayoutChange]
  );

  const handleElementDragEnd = useCallback(
    (elementId: string, x: number, y: number) => {
      if (!onLayoutChange) return;
      const updatedElements = visualElements.map((el) =>
        el.id === elementId ? { ...el, positionX: x, positionY: y } : el
      );
      onLayoutChange(tables, updatedElements);
    },
    [tables, visualElements, onLayoutChange]
  );

  // Handle transform end (resize) for tables
  const handleTableTransformEnd = useCallback(
    (tableId: string, node: Konva.Node) => {
      if (!onLayoutChange) return;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const table = tables.find((t) => t.id === tableId);
      if (!table) return;

      const newWidth = Math.round(((table.width ?? 80) * scaleX) / GRID_SIZE) * GRID_SIZE;
      const newHeight = Math.round(((table.height ?? 80) * scaleY) / GRID_SIZE) * GRID_SIZE;

      // Reset scale to 1 and apply to width/height
      node.scaleX(1);
      node.scaleY(1);

      const x = Math.round(node.x() / GRID_SIZE) * GRID_SIZE;
      const y = Math.round(node.y() / GRID_SIZE) * GRID_SIZE;

      const updatedTables = tables.map((t) =>
        t.id === tableId
          ? { ...t, width: Math.max(40, newWidth), height: Math.max(40, newHeight), positionX: x, positionY: y }
          : t
      );
      onLayoutChange(updatedTables, visualElements);
    },
    [tables, visualElements, onLayoutChange]
  );

  // Handle transform end (resize) for visual elements
  const handleElementTransformEnd = useCallback(
    (elementId: string, node: Konva.Node) => {
      if (!onLayoutChange) return;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const element = visualElements.find((e) => e.id === elementId);
      if (!element) return;

      const newWidth = Math.round(((element.width ?? 60) * scaleX) / GRID_SIZE) * GRID_SIZE;
      const newHeight = Math.round(((element.height ?? 60) * scaleY) / GRID_SIZE) * GRID_SIZE;

      node.scaleX(1);
      node.scaleY(1);

      const x = Math.round(node.x() / GRID_SIZE) * GRID_SIZE;
      const y = Math.round(node.y() / GRID_SIZE) * GRID_SIZE;

      const updatedElements = visualElements.map((el) =>
        el.id === elementId
          ? { ...el, width: Math.max(20, newWidth), height: Math.max(20, newHeight), positionX: x, positionY: y }
          : el
      );
      onLayoutChange(tables, updatedElements);
    },
    [tables, visualElements, onLayoutChange]
  );

  // Click/tap stage background to deselect in editor
  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (mode === "editor" && e.target === stageRef.current) {
        onEditorSelect?.(null);
      }
    },
    [mode, onEditorSelect]
  );

  // Zoom controls
  const zoomInFn = useCallback(() => {
    const center = { x: stageSize.width / 2, y: stageSize.height / 2 };
    const oldScale = scale;
    const newScale = Math.min(MAX_ZOOM, oldScale + ZOOM_STEP);
    const mousePointTo = {
      x: (center.x - position.x) / oldScale,
      y: (center.y - position.y) / oldScale,
    };
    setScale(newScale);
    setPosition({
      x: center.x - mousePointTo.x * newScale,
      y: center.y - mousePointTo.y * newScale,
    });
  }, [scale, position, stageSize]);

  const zoomOutFn = useCallback(() => {
    const center = { x: stageSize.width / 2, y: stageSize.height / 2 };
    const oldScale = scale;
    const newScale = Math.max(MIN_ZOOM, oldScale - ZOOM_STEP);
    const mousePointTo = {
      x: (center.x - position.x) / oldScale,
      y: (center.y - position.y) / oldScale,
    };
    setScale(newScale);
    setPosition({
      x: center.x - mousePointTo.x * newScale,
      y: center.y - mousePointTo.y * newScale,
    });
  }, [scale, position, stageSize]);

  const resetFit = useCallback(() => {
    if (initialFitRef.current) {
      setScale(initialFitRef.current.scale);
      setPosition(initialFitRef.current.position);
    } else {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    (el as unknown as Record<string, unknown>).__canvasControls = { zoomIn: zoomInFn, zoomOut: zoomOutFn, resetZoom: resetFit, getScale: () => scale, getPosition: () => position };
    return () => {
      if (el) (el as unknown as Record<string, unknown>).__canvasControls = undefined;
    };
  }, [zoomInFn, zoomOutFn, resetFit]);

  const isBooking = mode === "booking";
  const isEditor = mode === "editor";
  const bgFill = isBooking ? "#1e293b" : "#fafafa";

  // In booking mode, the Stage is NOT rendered until sizing is complete.
  // This is the bulletproof solution: there is no Konva canvas in the DOM
  // to show wrong scale/position. Only the measurement container div exists.
  const showStage = !isBooking || bookingSizingDone;

  return (
    <div
      ref={containerRef}
      data-canvas=""
      className={`relative w-full overflow-hidden rounded-xl ${
        isBooking ? "bg-slate-800 border border-slate-700/50" : "border bg-white"
      }`}
      style={isBooking && !showStage ? { minHeight: 220 } : undefined}
    >
      {/* Booking loading state — shown while waiting for container sizing */}
      {isBooking && !showStage && (
        <div className="flex items-center justify-center" style={{ minHeight: 220 }}>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-500 border-t-slate-200" />
        </div>
      )}

      {showStage && (
      <Stage
        ref={stageRef as React.RefObject<Konva.Stage>}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        draggable={!isBooking}
        onWheel={!isBooking ? handleWheel : undefined}
        onDragEnd={!isBooking ? handleDragEnd : undefined}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        {/* Background */}
        <Layer listening={false}>
          <Rect x={-5000} y={-5000} width={10000} height={10000} fill={bgFill} />
          {gridLines.map((line) => (
            <Line key={line.key} points={line.points} stroke="#e5e7eb" strokeWidth={0.5} listening={false} />
          ))}
        </Layer>

        {/* Visual elements */}
        <Layer>
          {visualElements.map((element) => (
            <VisualElementShape
              key={element.id}
              element={element}
              mode={mode}
              isSelected={isEditor && selectedEditorId === element.id}
              onSelect={isEditor ? () => onEditorSelect?.(element.id) : undefined}
              onDragEnd={!isBooking ? (x, y) => handleElementDragEnd(element.id, x, y) : undefined}
              onTransformEnd={isEditor ? (node) => handleElementTransformEnd(element.id, node) : undefined}
            />
          ))}
        </Layer>

        {/* Tables */}
        <Layer>
          {tables.map((table) => (
            <TableShape
              key={table.id}
              table={table}
              mode={mode}
              status={tableStatuses[table.id]}
              isSelected={isBooking ? selectedTableId === table.id : selectedEditorId === table.id}
              onSelect={isBooking
                ? (onTableSelect ? () => onTableSelect(table.id) : undefined)
                : (() => onEditorSelect?.(table.id))
              }
              onDragEnd={!isBooking ? (x, y) => handleTableDragEnd(table.id, x, y) : undefined}
              onTransformEnd={isEditor ? (node) => handleTableTransformEnd(table.id, node) : undefined}
            />
          ))}

          {/* Transformer for editor mode */}
          {isEditor && (
            <Transformer
              ref={transformerRef as React.RefObject<Konva.Transformer>}
              anchorSize={10}
              anchorCornerRadius={2}
              borderStroke="#3b82f6"
              anchorStroke="#3b82f6"
              anchorFill="#fff"
              rotateEnabled={false}
              keepRatio={false}
              boundBoxFunc={(_oldBox, newBox) => {
                // Minimum size
                if (newBox.width < 30 || newBox.height < 20) {
                  return _oldBox;
                }
                return newBox;
              }}
            />
          )}
        </Layer>
      </Stage>
      )}

      {/* Zoom indicator - editor only */}
      {!isBooking && (
        <div className="absolute bottom-3 right-3 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm">
          {Math.round(scale * 100)}%
        </div>
      )}
    </div>
  );
}
