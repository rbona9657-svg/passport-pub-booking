"use client";

import { useCallback } from "react";
import { Group, Rect, Circle, Ellipse, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { PubTable } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  available: "#22c55e",
  pending: "#eab308",
  booked: "#ef4444",
};

const SELECTED_STROKE = "#3b82f6";
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
}

export default function TableShape({
  table,
  mode,
  status,
  isSelected = false,
  onSelect,
  onDragEnd,
  onDblClick,
}: TableShapeProps) {
  const w = table.width ?? 80;
  const h = table.height ?? 80;
  const shape = table.shape ?? "rect";

  const fill =
    mode === "booking" && status ? STATUS_COLORS[status] : EDITOR_FILL;
  const stroke = isSelected
    ? SELECTED_STROKE
    : mode === "booking" && status
      ? STATUS_COLORS[status]
      : EDITOR_STROKE;
  const strokeWidth = isSelected ? 3 : 1.5;

  const isClickable =
    mode === "booking" ? status !== "booked" : true;
  const cursor = isClickable ? "pointer" : "default";

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
    if (isClickable && onSelect) {
      onSelect();
    }
  }, [isClickable, onSelect]);

  const tableLabel = `T${table.tableNumber}`;
  const seatLabel = `${table.seats}`;

  const fillOpacity = mode === "booking" ? 0.85 : 1;

  const renderShape = () => {
    switch (shape) {
      case "circle":
        return (
          <Circle
            x={w / 2}
            y={h / 2}
            radius={Math.min(w, h) / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={fillOpacity}
            shadowColor="rgba(0,0,0,0.15)"
            shadowBlur={4}
            shadowOffsetY={2}
          />
        );
      case "ellipse":
        return (
          <Ellipse
            x={w / 2}
            y={h / 2}
            radiusX={w / 2}
            radiusY={h / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={fillOpacity}
            shadowColor="rgba(0,0,0,0.15)"
            shadowBlur={4}
            shadowOffsetY={2}
          />
        );
      case "rect":
      default:
        return (
          <Rect
            x={0}
            y={0}
            width={w}
            height={h}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            cornerRadius={8}
            opacity={fillOpacity}
            shadowColor="rgba(0,0,0,0.15)"
            shadowBlur={4}
            shadowOffsetY={2}
          />
        );
    }
  };

  return (
    <Group
      x={table.positionX}
      y={table.positionY}
      rotation={table.rotation ?? 0}
      draggable={mode === "editor"}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={handleClick}
      onDblClick={onDblClick}
      onDblTap={onDblClick}
      style={{ cursor }}
    >
      {renderShape()}

      {/* Table number label */}
      <Text
        x={0}
        y={h / 2 - 14}
        width={w}
        text={tableLabel}
        fontSize={14}
        fontStyle="bold"
        fontFamily="system-ui, sans-serif"
        fill={mode === "booking" ? "#fff" : "#1e293b"}
        align="center"
        listening={false}
      />

      {/* Seat count */}
      <Text
        x={0}
        y={h / 2 + 2}
        width={w}
        text={seatLabel}
        fontSize={11}
        fontFamily="system-ui, sans-serif"
        fill={mode === "booking" ? "rgba(255,255,255,0.85)" : "#64748b"}
        align="center"
        listening={false}
      />
    </Group>
  );
}
