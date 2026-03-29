"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Crop, Check, X } from "lucide-react";

/** Default canvas dimensions matching FloorPlanCanvas */
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

interface CropSelectorProps {
  /** The canvas element to overlay on (used for sizing) */
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Current scale of the Konva stage */
  stageScale: number;
  /** Current position of the Konva stage */
  stagePosition: { x: number; y: number };
  /** Called when the user confirms the crop */
  onConfirm: (crop: { x: number; y: number; width: number; height: number }) => void;
  /** Called when the user cancels */
  onCancel: () => void;
  /** Existing crop to pre-fill */
  initialCrop?: { x: number; y: number; width: number; height: number } | null;
}

export default function CropSelector({
  canvasContainerRef,
  stageScale,
  stagePosition,
  onConfirm,
  onCancel,
  initialCrop,
}: CropSelectorProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [dragging, setDragging] = useState<"move" | "resize" | null>(null);
  const dragStart = useRef({ mx: 0, my: 0, left: 0, top: 0, width: 0, height: 0 });

  // Initialize crop rectangle
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();

    // Determine the canvas-space crop to display
    const crop = initialCrop && initialCrop.width > 0
      ? initialCrop
      : { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT };

    // Convert canvas coordinates to screen coordinates, clamped to container
    const rawLeft = crop.x * stageScale + stagePosition.x;
    const rawTop = crop.y * stageScale + stagePosition.y;
    const rawWidth = crop.width * stageScale;
    const rawHeight = crop.height * stageScale;

    setRect({
      left: Math.max(0, rawLeft),
      top: Math.max(0, rawTop),
      width: Math.min(rawWidth, bounds.width - Math.max(0, rawLeft)),
      height: Math.min(rawHeight, bounds.height - Math.max(0, rawTop)),
    });
  }, [canvasContainerRef, initialCrop, stageScale, stagePosition]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, mode: "move" | "resize") => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(mode);
      dragStart.current = {
        mx: e.clientX,
        my: e.clientY,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    },
    [rect]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, mode: "move" | "resize") => {
      e.stopPropagation();
      const touch = e.touches[0];
      setDragging(mode);
      dragStart.current = {
        mx: touch.clientX,
        my: touch.clientY,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    },
    [rect]
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (clientX: number, clientY: number) => {
      const dx = clientX - dragStart.current.mx;
      const dy = clientY - dragStart.current.my;

      if (dragging === "move") {
        setRect((prev) => ({
          ...prev,
          left: dragStart.current.left + dx,
          top: dragStart.current.top + dy,
        }));
      } else if (dragging === "resize") {
        setRect((prev) => ({
          ...prev,
          width: Math.max(60, dragStart.current.width + dx),
          height: Math.max(40, dragStart.current.height + dy),
        }));
      }
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onEnd = () => setDragging(null);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [dragging]);

  const handleConfirm = () => {
    // Convert screen coordinates back to canvas (Konva) coordinates
    const canvasX = (rect.left - stagePosition.x) / stageScale;
    const canvasY = (rect.top - stagePosition.y) / stageScale;
    const canvasW = rect.width / stageScale;
    const canvasH = rect.height / stageScale;

    onConfirm({
      x: Math.round(canvasX),
      y: Math.round(canvasY),
      width: Math.round(canvasW),
      height: Math.round(canvasH),
    });
  };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-20"
      style={{ cursor: dragging === "move" ? "grabbing" : "default" }}
    >
      {/* Dimmed overlay around crop area */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top dim */}
        <div
          className="absolute left-0 right-0 top-0 bg-black/60"
          style={{ height: Math.max(0, rect.top) }}
        />
        {/* Bottom dim */}
        <div
          className="absolute left-0 right-0 bottom-0 bg-black/60"
          style={{ top: rect.top + rect.height }}
        />
        {/* Left dim */}
        <div
          className="absolute left-0 bg-black/60"
          style={{ top: rect.top, height: rect.height, width: Math.max(0, rect.left) }}
        />
        {/* Right dim */}
        <div
          className="absolute right-0 bg-black/60"
          style={{ top: rect.top, height: rect.height, left: rect.left + rect.width }}
        />
      </div>

      {/* Crop rectangle */}
      <div
        className="absolute border-2 border-dashed border-blue-400"
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          cursor: dragging === "move" ? "grabbing" : "grab",
        }}
        onMouseDown={(e) => handleMouseDown(e, "move")}
        onTouchStart={(e) => handleTouchStart(e, "move")}
      >
        {/* Resize handle (bottom-right) */}
        <div
          className="absolute -bottom-2 -right-2 h-5 w-5 rounded-full bg-blue-500 border-2 border-white shadow-md"
          style={{ cursor: "nwse-resize" }}
          onMouseDown={(e) => handleMouseDown(e, "resize")}
          onTouchStart={(e) => handleTouchStart(e, "resize")}
        />

        {/* Label */}
        <div className="absolute top-1 left-1 rounded bg-blue-500/90 px-1.5 py-0.5 text-[10px] text-white font-medium select-none pointer-events-none">
          <Crop className="h-3 w-3 inline mr-0.5" />
          Visible area
        </div>
      </div>

      {/* Action buttons */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-30">
        <Button
          size="sm"
          variant="destructive"
          onClick={onCancel}
          className="shadow-lg"
        >
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleConfirm}
          className="shadow-lg bg-blue-600 hover:bg-blue-700"
        >
          <Check className="h-4 w-4 mr-1" /> Confirm Crop & Save
        </Button>
      </div>
    </div>
  );
}
