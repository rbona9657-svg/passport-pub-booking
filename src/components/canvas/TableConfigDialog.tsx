"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import type { PubTable } from "@/types";

interface TableConfigDialogProps {
  table: PubTable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: {
    tableNumber: string;
    seats: number;
    shape: string;
    width?: number;
    height?: number;
  }) => void;
  onDelete: () => void;
}

export default function TableConfigDialog({
  table,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: TableConfigDialogProps) {
  const [tableNumber, setTableNumber] = useState("");
  const [seats, setSeats] = useState(4);
  const [shape, setShape] = useState("rect");
  const [width, setWidth] = useState(80);
  const [height, setHeight] = useState(80);

  useEffect(() => {
    if (table) {
      setTableNumber(table.tableNumber);
      setSeats(table.seats);
      setShape(table.shape ?? "rect");
      setWidth(table.width ?? 80);
      setHeight(table.height ?? 80);
    }
  }, [table]);

  const handleSave = () => {
    if (!tableNumber.trim()) return;
    onSave({
      tableNumber: tableNumber.trim(),
      seats: Math.max(1, seats),
      shape,
      width: Math.max(20, width),
      height: Math.max(20, height),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit Table</DialogTitle>
          <DialogDescription>
            Update table number, seat count, shape, and size.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="table-number">Table Number</Label>
            <Input
              id="table-number"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="e.g. 1, A1, VIP1"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="seats">Seats</Label>
            <Input
              id="seats"
              type="number"
              min={1}
              max={20}
              value={seats}
              onChange={(e) => setSeats(parseInt(e.target.value, 10) || 1)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="shape">Shape</Label>
            <Select value={shape} onValueChange={setShape}>
              <SelectTrigger id="shape">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rect">Rectangle</SelectItem>
                <SelectItem value="circle">Circle</SelectItem>
                <SelectItem value="ellipse">Ellipse</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="width">Width (px)</Label>
              <Input
                id="width"
                type="number"
                min={20}
                max={500}
                step={20}
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value, 10) || 80)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="height">Height (px)</Label>
              <Input
                id="height"
                type="number"
                min={20}
                max={500}
                step={20}
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value, 10) || 80)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            className="w-full sm:w-auto"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Table
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
