"use client";

import { useCallback } from "react";
import { Group, Rect, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { VisualElement } from "@/types";

const GRID_SIZE = 20;

const ELEMENT_STYLES: Record<
  string,
  { fill: string; stroke: string; textColor: string; label: string }
> = {
  entrance: {
    fill: "#22c55e",
    stroke: "#16a34a",
    textColor: "#fff",
    label: "Entrance",
  },
  tv: {
    fill: "#1e293b",
    stroke: "#0f172a",
    textColor: "#fff",
    label: "TV",
  },
  toilet: {
    fill: "#3b82f6",
    stroke: "#2563eb",
    textColor: "#fff",
    label: "WC",
  },
  bar: {
    fill: "#d97706",
    stroke: "#b45309",
    textColor: "#fff",
    label: "Bar",
  },
  wall: {
    fill: "#6b7280",
    stroke: "#4b5563",
    textColor: "#fff",
    label: "",
  },
  stage: {
    fill: "#9333ea",
    stroke: "#7e22ce",
    textColor: "#fff",
    label: "Stage",
  },
  custom: {
    fill: "#94a3b8",
    stroke: "#64748b",
    textColor: "#fff",
    label: "",
  },
};

interface VisualElementShapeProps {
  element: VisualElement;
  mode: "editor" | "booking";
  onDragEnd?: (x: number, y: number) => void;
}

export default function VisualElementShape({
  element,
  mode,
  onDragEnd,
}: VisualElementShapeProps) {
  const w = element.width ?? 60;
  const h = element.height ?? 60;
  const style = ELEMENT_STYLES[element.type] ?? ELEMENT_STYLES.custom;

  const displayLabel =
    element.type === "custom"
      ? element.label ?? "Custom"
      : element.type === "wall"
        ? element.label ?? ""
        : style.label;

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

  return (
    <Group
      x={element.positionX}
      y={element.positionY}
      rotation={element.rotation ?? 0}
      draggable={mode === "editor"}
      onDragEnd={handleDragEnd}
    >
      <Rect
        x={0}
        y={0}
        width={w}
        height={h}
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth={1}
        cornerRadius={element.type === "wall" ? 0 : 4}
        opacity={0.9}
      />

      {displayLabel && (
        <Text
          x={0}
          y={0}
          width={w}
          height={h}
          text={displayLabel}
          fontSize={element.type === "wall" ? 9 : 12}
          fontStyle="bold"
          fontFamily="system-ui, sans-serif"
          fill={style.textColor}
          align="center"
          verticalAlign="middle"
          listening={false}
        />
      )}
    </Group>
  );
}
