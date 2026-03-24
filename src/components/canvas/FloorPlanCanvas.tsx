"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { Stage, Layer, Rect, Line } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type Konva from "konva";
import type { PubTable, VisualElement } from "@/types";
import TableShape from "./TableShape";
import VisualElementShape from "./VisualElementShape";

const GRID_SIZE = 20;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const PADDING = 30;

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
}

function getContentBounds(tables: PubTable[], visualElements: VisualElement[]) {
  if (tables.length === 0 && visualElements.length === 0) {
    return { minX: 0, minY: 0, maxX: 400, maxY: 300 };
  }
  const allItems = [
    ...tables.map((t) => ({ x: t.positionX, y: t.positionY, w: t.width ?? 80, h: t.height ?? 80 })),
    ...visualElements.map((e) => ({ x: e.positionX, y: e.positionY, w: e.width ?? 60, h: e.height ?? 60 })),
  ];
  return {
    minX: Math.min(...allItems.map((i) => i.x)) - PADDING,
    minY: Math.min(...allItems.map((i) => i.y)) - PADDING,
    maxX: Math.max(...allItems.map((i) => i.x + i.w)) + PADDING,
    maxY: Math.max(...allItems.map((i) => i.y + i.h)) + PADDING,
  };
}

export default function FloorPlanCanvas({
  mode,
  tables,
  visualElements,
  tableStatuses = {},
  selectedTableId,
  onTableSelect,
  onLayoutChange,
}: FloorPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 500 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Responsive sizing + auto-fit in booking mode
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const containerWidth = rect.width;

      if (mode === "booking" && tables.length > 0) {
        // Tight-fit: calculate canvas size from content bounds
        const bounds = getContentBounds(tables, visualElements);
        const contentW = bounds.maxX - bounds.minX;
        const contentH = bounds.maxY - bounds.minY;
        const aspectRatio = contentH / contentW;

        // Fit width to container, calculate height from aspect ratio
        const fitScale = containerWidth / contentW;
        const canvasHeight = Math.min(contentW * aspectRatio * fitScale, window.innerHeight * 0.6);
        const finalScale = Math.min(containerWidth / contentW, canvasHeight / contentH);

        setStageSize({ width: containerWidth, height: canvasHeight });
        setScale(finalScale);
        setPosition({
          x: (containerWidth - contentW * finalScale) / 2 - bounds.minX * finalScale,
          y: (canvasHeight - contentH * finalScale) / 2 - bounds.minY * finalScale,
        });
      } else {
        // Editor mode: full canvas
        const isMobile = containerWidth < 640;
        const maxH = isMobile ? 600 : 700;
        const minH = 400;
        const height = Math.max(minH, Math.min(maxH, window.innerHeight - 200));
        setStageSize({ width: containerWidth, height });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [mode, tables.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw grid lines (editor only)
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

  const zoomIn = useCallback(() => setScale((s) => Math.min(MAX_ZOOM, s + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(MIN_ZOOM, s - ZOOM_STEP)), []);
  const resetZoom = useCallback(() => { setScale(1); setPosition({ x: 0, y: 0 }); }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    (el as unknown as Record<string, unknown>).__canvasControls = { zoomIn, zoomOut, resetZoom };
  }, [zoomIn, zoomOut, resetZoom]);

  const isBooking = mode === "booking";
  const bgFill = isBooking ? "#1e293b" : "#fafafa";

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-xl ${
        isBooking ? "bg-slate-800 border border-slate-700/50" : "border bg-white"
      }`}
    >
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
      >
        {/* Background layer */}
        <Layer listening={false}>
          <Rect
            x={-5000}
            y={-5000}
            width={10000}
            height={10000}
            fill={bgFill}
          />
          {gridLines.map((line) => (
            <Line
              key={line.key}
              points={line.points}
              stroke="#e5e7eb"
              strokeWidth={0.5}
              listening={false}
            />
          ))}
        </Layer>

        {/* Visual elements layer */}
        <Layer>
          {visualElements.map((element) => (
            <VisualElementShape
              key={element.id}
              element={element}
              mode={mode}
              onDragEnd={
                !isBooking
                  ? (x, y) => handleElementDragEnd(element.id, x, y)
                  : undefined
              }
            />
          ))}
        </Layer>

        {/* Tables layer */}
        <Layer>
          {tables.map((table) => (
            <TableShape
              key={table.id}
              table={table}
              mode={mode}
              status={tableStatuses[table.id]}
              isSelected={selectedTableId === table.id}
              onSelect={
                onTableSelect ? () => onTableSelect(table.id) : undefined
              }
              onDragEnd={
                !isBooking
                  ? (x, y) => handleTableDragEnd(table.id, x, y)
                  : undefined
              }
            />
          ))}
        </Layer>
      </Stage>

      {/* Zoom indicator - editor only */}
      {!isBooking && (
        <div className="absolute bottom-3 right-3 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm">
          {Math.round(scale * 100)}%
        </div>
      )}
    </div>
  );
}
