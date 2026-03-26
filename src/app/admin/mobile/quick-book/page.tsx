"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { PUB_HOURS } from "@/lib/constants";
import { toMinutesSinceOpen } from "@/lib/validations";
import {
  Check,
  Loader2,
} from "lucide-react";
import type { PubTable, VisualElement } from "@/types";

const FloorPlanCanvas = dynamic(() => import("@/components/canvas/FloorPlanCanvas"), {
  ssr: false,
  loading: () => <div className="h-[250px] bg-muted/30 rounded-xl animate-pulse" />,
});

export default function MobileQuickBookPage() {
  const [tables, setTables] = useState<PubTable[]>([]);
  const [elements, setElements] = useState<VisualElement[]>([]);
  const [floorPlanId, setFloorPlanId] = useState<string | null>(null);
  const [tableStatuses, setTableStatuses] = useState<Record<string, "available" | "pending" | "booked">>({});
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [reservationName, setReservationName] = useState("");
  const [guestCount, setGuestCount] = useState("2");
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split("T")[0]);
  const [arrivalTime, setArrivalTime] = useState("19:00");
  const [departureTime, setDepartureTime] = useState("21:00");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleArrivalChange = (val: string) => {
    setArrivalTime(val);
    if (toMinutesSinceOpen(departureTime) <= toMinutesSinceOpen(val)) {
      const idx = PUB_HOURS.indexOf(val as typeof PUB_HOURS[number]);
      if (idx >= 0 && idx < PUB_HOURS.length - 1) {
        setDepartureTime(PUB_HOURS[idx + 1]);
      }
    }
  };

  const handleDepartureChange = (val: string) => {
    setDepartureTime(val);
    if (toMinutesSinceOpen(val) <= toMinutesSinceOpen(arrivalTime)) {
      const idx = PUB_HOURS.indexOf(val as typeof PUB_HOURS[number]);
      if (idx > 0) {
        setArrivalTime(PUB_HOURS[idx - 1]);
      }
    }
  };

  useEffect(() => {
    fetch("/api/floor-plan")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setFloorPlanId(data.id);
          setTables(data.tables || []);
          setElements(data.visualElements || []);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!floorPlanId) return;
    fetch(
      `/api/tables/availability?floorPlanId=${floorPlanId}&date=${bookingDate}&arrival=${arrivalTime}&departure=${departureTime}`
    )
      .then((res) => {
        if (!res.ok) throw new Error(`Availability API error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data && !data.error) setTableStatuses(data);
      })
      .catch(console.error);
  }, [floorPlanId, bookingDate, arrivalTime, departureTime]);

  const selectedTable = tables.find((t) => t.id === selectedTableId);

  const canSubmit = selectedTableId && reservationName.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: selectedTableId,
          reservationName: reservationName.trim(),
          guestCount: parseInt(guestCount),
          bookingDate,
          arrivalTime,
          departureTime,
          comment: comment || null,
        }),
      });

      if (res.ok) {
        const booking = await res.json();
        await fetch(`/api/bookings/${booking.id}/approve`, { method: "POST" });

        toast({ title: "Booking created & approved!" });
        setReservationName("");
        setGuestCount("2");
        setComment("");
        setSelectedTableId(null);

        if (floorPlanId) {
          const statusRes = await fetch(
            `/api/tables/availability?floorPlanId=${floorPlanId}&date=${bookingDate}&arrival=${arrivalTime}&departure=${departureTime}`
          );
          if (statusRes.ok) setTableStatuses(await statusRes.json());
        }
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to create booking", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to create booking", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 pb-4">
      <h1 className="text-lg font-bold tracking-tight">Quick Book</h1>

      {/* Floor plan first - tap to select table */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">
            Tap a green table to select
          </Label>
          {selectedTable && (
            <span className="text-xs font-medium text-primary">
              Table {selectedTable.tableNumber} ({selectedTable.seats} seats)
            </span>
          )}
        </div>
        <FloorPlanCanvas
          mode="booking"
          tables={tables}
          visualElements={elements}
          tableStatuses={tableStatuses}
          selectedTableId={selectedTableId}
          onTableSelect={setSelectedTableId}
        />
      </div>

      {/* Date & Time - date on its own row, times side by side */}
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Date</Label>
          <Input
            type="date"
            value={bookingDate}
            onChange={(e) => setBookingDate(e.target.value)}
            className="h-10 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">From</Label>
            <select
              value={arrivalTime}
              onChange={(e) => handleArrivalChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PUB_HOURS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">To</Label>
            <select
              value={departureTime}
              onChange={(e) => handleDepartureChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PUB_HOURS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Guest info - compact row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-[11px] text-muted-foreground">Guest Name *</Label>
          <Input
            value={reservationName}
            onChange={(e) => setReservationName(e.target.value)}
            placeholder="Name"
            className="h-10 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Guests</Label>
          <Input
            type="number"
            min="1"
            max="20"
            value={guestCount}
            onChange={(e) => setGuestCount(e.target.value)}
            className="h-10 text-sm text-center"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Notes (optional)</Label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Special requests..."
          rows={2}
          className="resize-none text-sm"
        />
      </div>

      {/* Submit */}
      <Button
        className="w-full h-11"
        onClick={handleSubmit}
        disabled={loading || !canSubmit}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Check className="h-4 w-4 mr-2" />
        )}
        {selectedTable
          ? `Book Table ${selectedTable.tableNumber}`
          : "Select a table first"
        }
      </Button>
    </div>
  );
}
