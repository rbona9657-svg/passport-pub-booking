"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import CanvasToolbar from "@/components/canvas/CanvasToolbar";
import TableConfigDialog from "@/components/canvas/TableConfigDialog";
import { Save, Loader2, Crop } from "lucide-react";
import type { PubTable, VisualElement } from "@/types";
import type { ViewportCrop } from "@/components/canvas/FloorPlanCanvas";
import CropSelector from "@/components/canvas/CropSelector";

const FloorPlanCanvas = dynamic(() => import("@/components/canvas/FloorPlanCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[500px] bg-muted/30 rounded-xl border border-border/40">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function FloorPlanEditor() {
  const [name, setName] = useState("Main Floor");
  const [tables, setTables] = useState<PubTable[]>([]);
  const [elements, setElements] = useState<VisualElement[]>([]);
  const [selectedEditorId, setSelectedEditorId] = useState<string | null>(null);
  const [configTable, setConfigTable] = useState<PubTable | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [copiedSize, setCopiedSize] = useState<{ width: number; height: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cropping, setCropping] = useState(false);
  const [savedCrop, setSavedCrop] = useState<ViewportCrop | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/floor-plan")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.tables) {
          setName(data.name || "Main Floor");
          setTables(data.tables || []);
          setElements(data.visualElements || []);
          if (data.viewportConfig?.crop) {
            setSavedCrop(data.viewportConfig.crop);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Start crop mode — user selects visible area before saving
  const handleStartSave = () => {
    setCropping(true);
  };

  const handleCropConfirm = async (crop: ViewportCrop) => {
    setCropping(false);
    setSavedCrop(crop);
    await doSave(crop);
  };

  const handleCropCancel = () => {
    setCropping(false);
  };

  const doSave = async (crop: ViewportCrop | null) => {
    setSaving(true);
    try {
      const res = await fetch("/api/floor-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tables, visualElements: elements, viewportCrop: crop }),
      });

      if (res.ok) {
        const data = await res.json();
        setTables(data.tables || []);
        setElements(data.visualElements || []);
        if (data.viewportConfig?.crop) {
          setSavedCrop(data.viewportConfig.crop);
        }
        toast({ title: "Floor plan saved!" });
      } else {
        toast({ title: "Error", description: "Failed to save", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddTable = (shape: "rect" | "circle" | "ellipse") => {
    const newTable: PubTable = {
      id: crypto.randomUUID(),
      floorPlanId: "" as string,
      tableNumber: `T${tables.length + 1}`,
      seats: 4,
      positionX: 300 + Math.random() * 100,
      positionY: 200 + Math.random() * 100,
      width: 80,
      height: 80,
      rotation: 0,
      shape,
      createdAt: null,
    };
    setTables((prev) => [...prev, newTable]);
  };

  const handleAddElement = (type: string) => {
    const newElement: VisualElement = {
      id: crypto.randomUUID(),
      floorPlanId: "" as string,
      type: type as VisualElement["type"],
      positionX: 100 + Math.random() * 100,
      positionY: 100 + Math.random() * 100,
      width: type === "bar" || type === "wall" ? 160 : 80,
      height: type === "wall" ? 20 : 60,
      rotation: 0,
      label: type === "custom" ? "Label" : null,
      icon: null,
      createdAt: null,
    };
    setElements((prev) => [...prev, newElement]);
  };

  const handleLayoutChange = useCallback((updatedTables: PubTable[], updatedElements: VisualElement[]) => {
    setTables(updatedTables);
    setElements(updatedElements);
  }, []);

  // Double-click table to open config
  const handleTableSelect = (tableId: string) => {
    const table = tables.find((t) => t.id === tableId);
    if (table) {
      setConfigTable(table);
      setConfigOpen(true);
    }
  };

  const handleTableConfigSave = (updates: { tableNumber: string; seats: number; shape: string; width?: number; height?: number }) => {
    setTables((prev) =>
      prev.map((t) =>
        t.id === configTable?.id
          ? {
              ...t,
              tableNumber: updates.tableNumber,
              seats: updates.seats,
              shape: updates.shape as PubTable["shape"],
              ...(updates.width != null && { width: updates.width }),
              ...(updates.height != null && { height: updates.height }),
            }
          : t
      )
    );
    setConfigOpen(false);
    setConfigTable(null);
  };

  const handleTableDelete = () => {
    if (configTable) {
      setTables((prev) => prev.filter((t) => t.id !== configTable.id));
      setConfigOpen(false);
      setConfigTable(null);
      setSelectedEditorId(null);
    }
  };

  // Copy size from selected object
  const handleCopySize = useCallback(() => {
    if (!selectedEditorId) return;
    const table = tables.find((t) => t.id === selectedEditorId);
    if (table) {
      setCopiedSize({ width: table.width ?? 80, height: table.height ?? 80 });
      toast({ title: "Size copied", description: `${table.width ?? 80} x ${table.height ?? 80}` });
      return;
    }
    const element = elements.find((e) => e.id === selectedEditorId);
    if (element) {
      setCopiedSize({ width: element.width ?? 60, height: element.height ?? 60 });
      toast({ title: "Size copied", description: `${element.width ?? 60} x ${element.height ?? 60}` });
    }
  }, [selectedEditorId, tables, elements, toast]);

  // Paste size to selected object
  const handlePasteSize = useCallback(() => {
    if (!selectedEditorId || !copiedSize) return;
    const tableIdx = tables.findIndex((t) => t.id === selectedEditorId);
    if (tableIdx >= 0) {
      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedEditorId ? { ...t, width: copiedSize.width, height: copiedSize.height } : t
        )
      );
      toast({ title: "Size applied" });
      return;
    }
    const elemIdx = elements.findIndex((e) => e.id === selectedEditorId);
    if (elemIdx >= 0) {
      setElements((prev) =>
        prev.map((e) =>
          e.id === selectedEditorId ? { ...e, width: copiedSize.width, height: copiedSize.height } : e
        )
      );
      toast({ title: "Size applied" });
    }
  }, [selectedEditorId, copiedSize, tables, elements, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Floor Plan Editor</h1>
          <p className="text-muted-foreground">Drag to move, drag handles to resize. Double-click a table to edit.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="planName" className="text-sm whitespace-nowrap">Name:</Label>
            <Input
              id="planName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-40"
            />
          </div>
          <Button onClick={handleStartSave} disabled={saving || cropping}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crop className="h-4 w-4 mr-2" />}
            {saving ? "Saving..." : "Crop & Save"}
          </Button>
        </div>
      </div>

      <div ref={canvasContainerRef} className="relative">
        <CanvasToolbar
          onAddTable={handleAddTable}
          onAddElement={handleAddElement}
          onSave={handleStartSave}
          onZoomIn={() => {
            const el = document.querySelector("[data-canvas]") as HTMLElement | null;
            const controls = el && (el as unknown as Record<string, unknown>).__canvasControls as Record<string, () => void> | undefined;
            controls?.zoomIn?.();
          }}
          onZoomOut={() => {
            const el = document.querySelector("[data-canvas]") as HTMLElement | null;
            const controls = el && (el as unknown as Record<string, unknown>).__canvasControls as Record<string, () => void> | undefined;
            controls?.zoomOut?.();
          }}
          onResetZoom={() => {
            const el = document.querySelector("[data-canvas]") as HTMLElement | null;
            const controls = el && (el as unknown as Record<string, unknown>).__canvasControls as Record<string, () => void> | undefined;
            controls?.resetZoom?.();
          }}
          onCopySize={handleCopySize}
          onPasteSize={handlePasteSize}
          hasCopiedSize={!!copiedSize}
          hasSelection={!!selectedEditorId}
          saving={saving}
        />

        <FloorPlanCanvas
          mode="editor"
          tables={tables}
          visualElements={elements}
          onTableSelect={handleTableSelect}
          onLayoutChange={handleLayoutChange}
          selectedEditorId={selectedEditorId}
          onEditorSelect={setSelectedEditorId}
        />

        {cropping && (() => {
          const el = document.querySelector("[data-canvas]") as HTMLElement | null;
          const controls = el && (el as unknown as Record<string, unknown>).__canvasControls as Record<string, () => unknown> | undefined;
          const sc = controls?.getScale ? (controls.getScale() as number) : 1;
          const pos = controls?.getPosition ? (controls.getPosition() as { x: number; y: number }) : { x: 0, y: 0 };
          return (
            <CropSelector
              canvasContainerRef={canvasContainerRef}
              stageScale={sc}
              stagePosition={pos}
              initialCrop={savedCrop}
              onConfirm={handleCropConfirm}
              onCancel={handleCropCancel}
            />
          );
        })()}
      </div>

      {/* Size info for selected item */}
      {selectedEditorId && (() => {
        const t = tables.find((t) => t.id === selectedEditorId);
        const e = elements.find((e) => e.id === selectedEditorId);
        const w = t ? (t.width ?? 80) : e ? (e.width ?? 60) : null;
        const h = t ? (t.height ?? 80) : e ? (e.height ?? 60) : null;
        if (w === null) return null;
        return (
          <div className="text-xs text-muted-foreground">
            Selected: {w} x {h}px
            {copiedSize && <span className="ml-3">Clipboard: {copiedSize.width} x {copiedSize.height}px</span>}
          </div>
        );
      })()}

      <TableConfigDialog
        table={configTable}
        open={configOpen}
        onOpenChange={setConfigOpen}
        onSave={handleTableConfigSave}
        onDelete={handleTableDelete}
      />
    </div>
  );
}
