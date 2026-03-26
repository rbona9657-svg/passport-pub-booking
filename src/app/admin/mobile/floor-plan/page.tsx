"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import TableConfigDialog from "@/components/canvas/TableConfigDialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Save,
  Loader2,
  Plus,
  Square,
  Circle,
  RectangleHorizontal,
  DoorOpen,
  Beer,
  Tv,
  Mic,
  PanelTop,
  Tag,
  Copy,
  ClipboardPaste,
  Crop,
} from "lucide-react";
import type { PubTable, VisualElement } from "@/types";
import type { ViewportCrop } from "@/components/canvas/FloorPlanCanvas";
import CropSelector from "@/components/canvas/CropSelector";

const FloorPlanCanvas = dynamic(() => import("@/components/canvas/FloorPlanCanvas"), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-muted/30 rounded-xl animate-pulse" />,
});

export default function MobileFloorPlanPage() {
  const [tables, setTables] = useState<PubTable[]>([]);
  const [elements, setElements] = useState<VisualElement[]>([]);
  const [name, setName] = useState("Main Floor");
  const [selectedEditorId, setSelectedEditorId] = useState<string | null>(null);
  const [configTable, setConfigTable] = useState<PubTable | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [copiedSize, setCopiedSize] = useState<{ width: number; height: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cropping, setCropping] = useState(false);
  const [savedCrop, setSavedCrop] = useState<ViewportCrop | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
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
      floorPlanId: "",
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
    setToolbarOpen(false);
  };

  const handleAddElement = (type: string) => {
    const newElement: VisualElement = {
      id: crypto.randomUUID(),
      floorPlanId: "",
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
    setToolbarOpen(false);
  };

  const handleLayoutChange = useCallback((updatedTables: PubTable[], updatedElements: VisualElement[]) => {
    setTables(updatedTables);
    setElements(updatedElements);
  }, []);

  // Double-tap table opens config
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

  const handleCopySize = () => {
    if (!selectedEditorId) return;
    const t = tables.find((t) => t.id === selectedEditorId);
    if (t) {
      setCopiedSize({ width: t.width ?? 80, height: t.height ?? 80 });
      toast({ title: "Size copied" });
      return;
    }
    const e = elements.find((e) => e.id === selectedEditorId);
    if (e) {
      setCopiedSize({ width: e.width ?? 60, height: e.height ?? 60 });
      toast({ title: "Size copied" });
    }
  };

  const handlePasteSize = () => {
    if (!selectedEditorId || !copiedSize) return;
    if (tables.find((t) => t.id === selectedEditorId)) {
      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedEditorId ? { ...t, width: copiedSize.width, height: copiedSize.height } : t
        )
      );
      toast({ title: "Size applied" });
    } else if (elements.find((e) => e.id === selectedEditorId)) {
      setElements((prev) =>
        prev.map((e) =>
          e.id === selectedEditorId ? { ...e, width: copiedSize.width, height: copiedSize.height } : e
        )
      );
      toast({ title: "Size applied" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Get selected item info
  const selectedItem = selectedEditorId
    ? tables.find((t) => t.id === selectedEditorId) || elements.find((e) => e.id === selectedEditorId)
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Floor Plan</h1>
          <p className="text-xs text-muted-foreground">Drag to move. Use handles to resize.</p>
        </div>
        <Button size="sm" onClick={handleStartSave} disabled={saving || cropping} className="h-9">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Crop className="h-4 w-4 mr-1" />}
          {saving ? "Saving..." : "Crop & Save"}
        </Button>
      </div>

      {/* Canvas */}
      <div ref={canvasContainerRef} className="relative">
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

      {/* Selection toolbar - appears when an item is selected */}
      {selectedItem && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
          <span className="text-xs text-muted-foreground flex-1 truncate">
            {('tableNumber' in selectedItem) ? `Table ${(selectedItem as PubTable).tableNumber}` : `${(selectedItem as VisualElement).type}`}
            {" "}&middot;{" "}
            {(selectedItem as { width?: number | null }).width ?? 80} x {(selectedItem as { height?: number | null }).height ?? 80}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={handleCopySize}
          >
            <Copy className="h-3.5 w-3.5 mr-1" />
            Copy Size
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={handlePasteSize}
            disabled={!copiedSize}
          >
            <ClipboardPaste className="h-3.5 w-3.5 mr-1" />
            Paste
          </Button>
        </div>
      )}

      {/* Floating add button */}
      <div className="fixed bottom-20 right-4 z-40">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={() => setToolbarOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Add items bottom sheet */}
      <Sheet open={toolbarOpen} onOpenChange={setToolbarOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Add to Floor Plan</SheetTitle>
            <SheetDescription>Choose a table shape or venue element to add.</SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Tables</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleAddTable("rect")}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-4 hover:bg-accent active:bg-accent/80 transition-colors"
                >
                  <Square className="h-6 w-6" />
                  <span className="text-xs">Rectangle</span>
                </button>
                <button
                  onClick={() => handleAddTable("circle")}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-4 hover:bg-accent active:bg-accent/80 transition-colors"
                >
                  <Circle className="h-6 w-6" />
                  <span className="text-xs">Round</span>
                </button>
                <button
                  onClick={() => handleAddTable("ellipse")}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-4 hover:bg-accent active:bg-accent/80 transition-colors"
                >
                  <RectangleHorizontal className="h-6 w-6" />
                  <span className="text-xs">Oval</span>
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Elements</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { type: "entrance", icon: DoorOpen, label: "Entrance" },
                  { type: "bar", icon: Beer, label: "Bar" },
                  { type: "tv", icon: Tv, label: "TV" },
                  { type: "toilet", icon: PanelTop, label: "WC" },
                  { type: "stage", icon: Mic, label: "Stage" },
                  { type: "wall", icon: RectangleHorizontal, label: "Wall" },
                  { type: "custom", icon: Tag, label: "Custom" },
                ].map((item) => (
                  <button
                    key={item.type}
                    onClick={() => handleAddElement(item.type)}
                    className="flex flex-col items-center gap-1 rounded-xl border border-border p-3 hover:bg-accent active:bg-accent/80 transition-colors"
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px]">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Table config dialog */}
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
