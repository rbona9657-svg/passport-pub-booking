"use client";

import { useCallback, useRef, useEffect } from "react";
import { Group, Rect, Circle, Ellipse, Text, Ring } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type Konva from "konva";
import type { PubTable } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  available: "#22c55e",
  pending: "#eab308",
  booked: "#ef4444",
};

const STATUS_FILLS: Record<string, string> = {
  available: "#166534",
  pending: "#854d0e",
  booked: "#991b1b",
};

const SELECTED_COLOR = "#3b82f6";
const SELECTED_GLOW = "#60a5fa";
const EDITOR_FILL = "#e2e8f0";
const EDITOR_STROKE = "#94a3b8";
const GRID_SIZE = 20;

interface TableShapeProps {
  table: PubTable;
  mode: "editor" | "booking";
  status?: "available" | "pending" | "booked";
  isSelected?: boolean;
  onSelect?: () => void;
  onDragEnd?: (x: number, y: number) => void;
  onDblClick?: () => void;
  onTransformEnd?: (node: Konva.Node) => void;
}

export default function TableShape({
  table,
  mode,
  status,
  isSelected = false,
  onSelect,
  onDragEnd,
  onDblClick,
  onTransformEnd,
}: TableShapeProps) {
  const groupRef = useRef<Konva.Group>(null);
  const w = table.width ?? 80;
  const h = table.height ?? 80;
  const shape = table.shape ?? "rect";
  const isBooking = mode === "booking";
  const isEditor = mode === "editor";

  // Colors
  let fill: string;
  let stroke: string;
  let strokeWidth: number;

  const effectiveStatus = status || (isBooking ? "available" : undefined);

  if (isBooking && isSelected) {
    fill = SELECTED_COLOR;
    stroke = SELECTED_GLOW;
    strokeWidth = 4;
  } else if (isBooking && effectiveStatus) {
    fill = STATUS_FILLS[effectiveStatus] || STATUS_COLORS[effectiveStatus];
    stroke = STATUS_COLORS[effectiveStatus];
    strokeWidth = 2;
  } else if (isEditor && isSelected) {
    fill = "#dbeafe";
    stroke = "#3b82f6";
    strokeWidth = 2;
  } else {
    fill = EDITOR_FILL;
    stroke = EDITOR_STROKE;
    strokeWidth = 1.5;
  }

  const isClickable = isBooking ? effectiveStatus !== "booked" : true;

  const handleDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      if (!onDragEnd) return;
      const node = e.target;
      const x = Math.round(node.x() / GRID_SIZE) * GRID_SIZE;
      const y = Math.round(node.y() / GRID_SIZE) * GRID_SIZE;
      node.position({ x, y });
      onDragEnd(x, y);
    },
    [onDragEnd]
  );

  const handleClick = useCallback(() => {
    if (isClickable && onSelect) onSelect();
  }, [isClickable, onSelect]);

  // Handle transform end
  useEffect(() => {
    if (!isEditor || !groupRef.current) return;
    const group = groupRef.current;
    const handler = () => {
      onTransformEnd?.(group);
    };
    group.on("transformend", handler);
    return () => {
      group.off("transformend", handler);
    };
  }, [isEditor, onTransformEnd]);

  const tableLabel = table.tableNumber.startsWith("T") ? table.tableNumber : `T${table.tableNumber}`;
  const seatLabel = `${table.seats} seats`;

  const renderShape = () => {
    const shadowProps = isBooking && isSelected
      ? { shadowColor: SELECTED_GLOW, shadowBlur: 20, shadowOpacity: 0.8 }
      : { shadowColor: "rgba(0,0,0,0.3)", shadowBlur: 6, shadowOffsetY: 2 };

    switch (shape) {
      case "circle":
        return (
          <Circle
            x={w / 2} y={h / 2}
            radius={Math.min(w, h) / 2}
            fill={fill} stroke={stroke} strokeWidth={strokeWidth}
            {...shadowProps}
          />
        );
      case "ellipse":
        return (
          <Ellipse
            x={w / 2} y={h / 2}
            radiusX={w / 2} radiusY={h / 2}
            fill={fill} stroke={stroke} strokeWidth={strokeWidth}
            {...shadowProps}
          />
        );
      default:
        return (
          <Rect
            x={0} y={0} width={w} height={h}
            fill={fill} stroke={stroke} strokeWidth={strokeWidth}
            cornerRadius={10}
            {...shadowProps}
          />
        );
    }
  };

  // Selection ring for booking mode
  const renderSelectionRing = () => {
    if (!isBooking || !isSelected) return null;
    const radius = Math.max(w, h) / 2 + 8;
    return (
      <Ring
        x={w / 2} y={h / 2}
        innerRadius={radius - 3}
        outerRadius={radius}
        fill={SELECTED_GLOW}
        opacity={0.6}
        listening={false}
      />
    );
  };

  return (
    <Group
      id={table.id}
      ref={groupRef as React.RefObject<Konva.Group>}
      x={table.positionX}
      y={table.positionY}
      rotation={table.rotation ?? 0}
      draggable={isEditor}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={handleClick}
      onDblClick={onDblClick}
      onDblTap={onDblClick}
    >
      {/* Selection ring (behind the table) */}
      {renderSelectionRing()}

      {/* Table shape */}
      {renderShape()}

      {/* Table number */}
      <Text
        x={0}
        y={h / 2 - 14}
        width={w}
        text={tableLabel}
        fontSize={isBooking ? 13 : 14}
        fontStyle="bold"
        fontFamily="system-ui, sans-serif"
        fill={isBooking ? "#fff" : "#1e293b"}
        align="center"
        listening={false}
      />

      {/* Seat count */}
      <Text
        x={0}
        y={h / 2 + 2}
        width={w}
        text={seatLabel}
        fontSize={10}
        fontFamily="system-ui, sans-serif"
        fill={isBooking ? "rgba(255,255,255,0.8)" : "#64748b"}
        align="center"
        listening={false}
      />

      {/* "SELECTED" label on top */}
      {isBooking && isSelected && (
        <Text
          x={0}
          y={-18}
          width={w}
          text="SELECTED"
          fontSize={9}
          fontStyle="bold"
          fontFamily="system-ui, sans-serif"
          fill={SELECTED_GLOW}
          align="center"
          listening={false}
        />
      )}
    </Group>
  );
}
