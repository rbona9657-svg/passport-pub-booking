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
  selectedEditorId?: string | null;
  onEditorSelect?: (id: string | null) => void;
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
  selectedEditorId,
  onEditorSelect,
}: FloorPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 500 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const initialFitRef = useRef<{ scale: number; position: { x: number; y: number } } | null>(null);

  // Responsive sizing + auto-fit in booking mode
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const containerWidth = rect.width;

      // Skip if container hasn't laid out yet
      if (containerWidth < 50) return;

      const mobile = containerWidth < 768;
      setIsMobile(mobile);

      if (mode === "booking" && tables.length > 0) {
        const bounds = getContentBounds(tables, visualElements);
        const contentW = bounds.maxX - bounds.minX;
        const contentH = bounds.maxY - bounds.minY;

        // Scale to fit width, then cap height for compact display
        const fitScale = containerWidth / contentW;
        const fittedHeight = contentH * fitScale;
        const maxH = mobile ? 300 : 400;
        const canvasHeight = Math.min(fittedHeight, maxH);
        const finalScale = Math.min(containerWidth / contentW, canvasHeight / contentH);
        const pos = {
          x: (containerWidth - contentW * finalScale) / 2 - bounds.minX * finalScale,
          y: (canvasHeight - contentH * finalScale) / 2 - bounds.minY * finalScale,
        };

        setStageSize({ width: containerWidth, height: canvasHeight });
        setScale(finalScale);
        setPosition(pos);
        initialFitRef.current = { scale: finalScale, position: pos };
      } else {
        const maxH = mobile ? 500 : 700;
        const minH = 350;
        const height = Math.max(minH, Math.min(maxH, window.innerHeight - 200));
        setStageSize({ width: containerWidth, height });
      }
    };

    updateSize();

    // Use ResizeObserver to handle late layout (e.g. client-side navigation)
    const el = containerRef.current;
    let observer: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateSize);
      observer.observe(el);
    }

    window.addEventListener("resize", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
      observer?.disconnect();
    };
  }, [mode, tables.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
    (el as unknown as Record<string, unknown>).__canvasControls = { zoomIn: zoomInFn, zoomOut: zoomOutFn, resetZoom: resetFit };
  }, [zoomInFn, zoomOutFn, resetFit]);

  const isBooking = mode === "booking";
  const isEditor = mode === "editor";
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

      {/* Zoom indicator - editor only */}
      {!isBooking && (
        <div className="absolute bottom-3 right-3 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm">
          {Math.round(scale * 100)}%
        </div>
      )}
    </div>
  );
}
