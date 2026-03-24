"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Layers,
  Save,
  ZoomIn,
  ZoomOut,
  Maximize,
  Square,
  Circle,
  Loader2,
  DoorOpen,
  Tv,
  Beer,
  Mic,
  RectangleHorizontal,
  PanelTop,
  Tag,
  Copy,
  ClipboardPaste,
} from "lucide-react";

interface CanvasToolbarProps {
  onAddTable: (shape: "rect" | "circle" | "ellipse") => void;
  onAddElement: (type: string) => void;
  onSave: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onCopySize?: () => void;
  onPasteSize?: () => void;
  hasCopiedSize?: boolean;
  hasSelection?: boolean;
  saving?: boolean;
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onClick} disabled={disabled}>
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function CanvasToolbar({
  onAddTable,
  onAddElement,
  onSave,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onCopySize,
  onPasteSize,
  hasCopiedSize = false,
  hasSelection = false,
  saving = false,
}: CanvasToolbarProps) {
  return (
    <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5 rounded-lg border bg-background/95 p-1.5 shadow-lg backdrop-blur-sm">
      {/* Add Table */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" title="Add Table">
            <Plus className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem onClick={() => onAddTable("rect")}>
            <Square className="mr-2 h-4 w-4" />
            Rectangle Table
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddTable("circle")}>
            <Circle className="mr-2 h-4 w-4" />
            Round Table
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddTable("ellipse")}>
            <RectangleHorizontal className="mr-2 h-4 w-4" />
            Oval Table
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add Element */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" title="Add Element">
            <Layers className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem onClick={() => onAddElement("entrance")}>
            <DoorOpen className="mr-2 h-4 w-4" />
            Entrance
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddElement("bar")}>
            <Beer className="mr-2 h-4 w-4" />
            Bar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddElement("tv")}>
            <Tv className="mr-2 h-4 w-4" />
            TV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddElement("toilet")}>
            <PanelTop className="mr-2 h-4 w-4" />
            Toilet (WC)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddElement("stage")}>
            <Mic className="mr-2 h-4 w-4" />
            Stage
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddElement("wall")}>
            <RectangleHorizontal className="mr-2 h-4 w-4" />
            Wall
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddElement("custom")}>
            <Tag className="mr-2 h-4 w-4" />
            Custom
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Separator */}
      <div className="mx-1 h-px bg-border" />

      {/* Copy/Paste Size */}
      {onCopySize && (
        <ToolbarButton
          icon={Copy}
          label="Copy Size"
          onClick={onCopySize}
          disabled={!hasSelection}
        />
      )}
      {onPasteSize && (
        <ToolbarButton
          icon={ClipboardPaste}
          label="Paste Size"
          onClick={onPasteSize}
          disabled={!hasSelection || !hasCopiedSize}
        />
      )}

      {(onCopySize || onPasteSize) && <div className="mx-1 h-px bg-border" />}

      {/* Zoom controls */}
      <ToolbarButton icon={ZoomIn} label="Zoom In" onClick={onZoomIn} />
      <ToolbarButton icon={ZoomOut} label="Zoom Out" onClick={onZoomOut} />
      <ToolbarButton icon={Maximize} label="Reset Zoom" onClick={onResetZoom} />

      {/* Separator */}
      <div className="mx-1 h-px bg-border" />

      {/* Save */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onSave}
        disabled={saving}
        title="Save Layout"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
