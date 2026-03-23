"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import CanvasToolbar from "@/components/canvas/CanvasToolbar";
import TableConfigDialog from "@/components/canvas/TableConfigDialog";
import { Save, Loader2 } from "lucide-react";
import type { PubTable, VisualElement } from "@/types";

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
  const [selectedTable, setSelectedTable] = useState<PubTable | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stageScale, setStageScale] = useState(1);
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Floor Plan Editor</h1>
          <p className="text-muted-foreground">Drag and drop tables to design your layout</p>
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
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      <div className="relative">
        <CanvasToolbar
          onAddTable={handleAddTable}
          onAddElement={handleAddElement}
          onSave={handleSave}
          onZoomIn={() => setStageScale((s) => Math.min(s + 0.2, 3))}
          onZoomOut={() => setStageScale((s) => Math.max(s - 0.2, 0.3))}
          onResetZoom={() => setStageScale(1)}
          saving={saving}
        />

        <FloorPlanCanvas
          mode="editor"
          tables={tables}
          visualElements={elements}
          onTableSelect={handleTableSelect}
          onLayoutChange={handleLayoutChange}
        />
      </div>

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
