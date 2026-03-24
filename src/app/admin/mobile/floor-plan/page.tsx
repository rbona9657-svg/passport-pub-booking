"use client";

import { useEffect, useState, useCallback } from "react";
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
  Layers,
  Square,
  Circle,
  RectangleHorizontal,
  DoorOpen,
  Beer,
  Tv,
  Mic,
  PanelTop,
  Tag,
} from "lucide-react";
import type { PubTable, VisualElement } from "@/types";

const FloorPlanCanvas = dynamic(() => import("@/components/canvas/FloorPlanCanvas"), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-muted/30 rounded-xl animate-pulse" />,
});

export default function MobileFloorPlanPage() {
  const [tables, setTables] = useState<PubTable[]>([]);
  const [elements, setElements] = useState<VisualElement[]>([]);
  const [name, setName] = useState("Main Floor");
  const [selectedTable, setSelectedTable] = useState<PubTable | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/floor-plan")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.tables) {
          setName(data.name || "Main Floor");
          setTables(data.tables || []);
          setElements(data.visualElements || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/floor-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tables, visualElements: elements }),
      });

      if (res.ok) {
        const data = await res.json();
        setTables(data.tables || []);
        setElements(data.visualElements || []);
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

  const handleTableSelect = (tableId: string) => {
    const table = tables.find((t) => t.id === tableId);
    if (table) {
      setSelectedTable(table);
      setConfigOpen(true);
    }
  };

  const handleTableConfigSave = (updates: { tableNumber: string; seats: number; shape: string }) => {
    setTables((prev) =>
      prev.map((t) =>
        t.id === selectedTable?.id
          ? { ...t, tableNumber: updates.tableNumber, seats: updates.seats, shape: updates.shape as PubTable["shape"] }
          : t
      )
    );
    setConfigOpen(false);
    setSelectedTable(null);
  };

  const handleTableDelete = () => {
    if (selectedTable) {
      setTables((prev) => prev.filter((t) => t.id !== selectedTable.id));
      setConfigOpen(false);
      setSelectedTable(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Floor Plan</h1>
          <p className="text-xs text-muted-foreground">Drag tables to rearrange. Tap to edit.</p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving} className="h-9">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Save
        </Button>
      </div>

      {/* Canvas */}
      <div className="relative">
        <FloorPlanCanvas
          mode="editor"
          tables={tables}
          visualElements={elements}
          onTableSelect={handleTableSelect}
          onLayoutChange={handleLayoutChange}
        />
      </div>

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
        table={selectedTable}
        open={configOpen}
        onOpenChange={setConfigOpen}
        onSave={handleTableConfigSave}
        onDelete={handleTableDelete}
      />
    </div>
  );
}
