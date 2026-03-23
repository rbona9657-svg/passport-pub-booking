"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import CanvasToolbar from "@/components/canvas/CanvasToolbar";
import TableConfigDialog from "@/components/canvas/TableConfigDialog";
import { Save, Loader2, Lock, LogOut } from "lucide-react";
import type { PubTable, VisualElement } from "@/types";

const FloorPlanCanvas = dynamic(() => import("@/components/canvas/FloorPlanCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[500px] bg-muted/30 rounded-xl border border-border/40">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function SetupPage() {
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  // Floor plan state
  const [name, setName] = useState("Main Floor");
  const [tables, setTables] = useState<PubTable[]>([]);
  const [elements, setElements] = useState<VisualElement[]>([]);
  const [selectedTable, setSelectedTable] = useState<PubTable | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stageScale, setStageScale] = useState(1);
  const { toast } = useToast();

  const storedToken = typeof window !== "undefined" ? sessionStorage.getItem("setup_token") : null;

  useEffect(() => {
    if (storedToken) {
      setToken(storedToken);
      setAuthenticated(true);
    }
  }, [storedToken]);

  useEffect(() => {
    if (authenticated && token) {
      setLoading(true);
      fetch("/api/setup", { headers: { "x-setup-token": token } })
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
    }
  }, [authenticated, token]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setError("");
    try {
      const res = await fetch("/api/setup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.valid) {
        sessionStorage.setItem("setup_token", token);
        setAuthenticated(true);
      } else {
        setError("Invalid setup token");
      }
    } catch {
      setError("Failed to verify token");
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("setup_token");
    setAuthenticated(false);
    setToken("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-token": token,
        },
        body: JSON.stringify({ name, tables, visualElements: elements }),
      });
      if (res.ok) {
        const data = await res.json();
        setTables(data.tables || []);
        setElements(data.visualElements || []);
        toast({ title: "Floor plan saved successfully!" });
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

  // ---- LOGIN SCREEN ----
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4">
        <Card className="w-full max-w-md border-slate-700/50 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white font-bold text-lg">
              PP
            </div>
            <CardTitle className="text-2xl text-white">Passport Pub Setup</CardTitle>
            <CardDescription className="text-slate-400">
              Enter your admin setup token to configure the pub layout
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token" className="text-slate-300">Setup Token</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="Enter setup token..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  autoFocus
                  className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}
              <Button type="submit" className="w-full h-11 bg-indigo-600 hover:bg-indigo-700" disabled={verifying}>
                {verifying ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Access Setup
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- FLOOR PLAN EDITOR ----
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-sm">
              PP
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Floor Plan Setup</h1>
              <p className="text-xs text-slate-400">Drag tables to design your pub layout</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              <Label htmlFor="planName" className="text-sm text-slate-300 whitespace-nowrap">Name:</Label>
              <Input
                id="planName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-36 bg-slate-800/50 border-slate-600 text-white text-sm h-9"
              />
            </div>
            <Button onClick={handleSave} disabled={saving} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-800">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="rounded-lg bg-indigo-600/10 border border-indigo-500/20 px-4 py-3 mb-4">
          <p className="text-sm text-indigo-300">
            <strong>How to use:</strong> Use the toolbar on the left to add tables and visual elements (entrance, TV, toilet, bar, etc.).
            Drag items to position them. Double-click a table to edit its number, seats, and shape. Click <strong>Save</strong> when done.
          </p>
        </div>
      </div>

      {/* Canvas */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="relative rounded-xl overflow-hidden border border-slate-700/50 bg-slate-800/30">
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
