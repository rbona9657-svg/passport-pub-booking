"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { PUB_HOURS } from "@/lib/constants";
import { toMinutesSinceOpen } from "@/lib/validations";
import { CalendarPlus, Loader2 } from "lucide-react";
import type { PubTable, VisualElement } from "@/types";

const FloorPlanCanvas = dynamic(() => import("@/components/canvas/FloorPlanCanvas"), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-muted/30 rounded-xl animate-pulse" />,
});

export default function QuickBookPage() {
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
      .then((res) => res.json())
      .then(setTableStatuses)
      .catch(console.error);
  }, [floorPlanId, bookingDate, arrivalTime, departureTime]);

  const selectedTable = tables.find((t) => t.id === selectedTableId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTableId) {
      toast({ title: "Select a table", description: "Click a table on the floor plan", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // Admin quick book creates an approved booking directly
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: selectedTableId,
          reservationName,
          guestCount: parseInt(guestCount),
          bookingDate,
          arrivalTime,
          departureTime,
          comment: comment || null,
        }),
      });

      if (res.ok) {
        // Auto-approve since it's admin-created
        const booking = await res.json();
        await fetch(`/api/bookings/${booking.id}/approve`, { method: "POST" });

        toast({ title: "Booking Created & Approved!" });
        setReservationName("");
        setGuestCount("2");
        setComment("");
        setSelectedTableId(null);

        // Refresh availability
        const statusRes = await fetch(
          `/api/tables/availability?floorPlanId=${floorPlanId}&date=${bookingDate}&arrival=${arrivalTime}&departure=${departureTime}`
        );
        if (statusRes.ok) setTableStatuses(await statusRes.json());
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quick Book</h1>
        <p className="text-muted-foreground">Quickly register phone or walk-in bookings</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarPlus className="h-4 w-4" />
              Booking Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Reservation Name</Label>
                <Input
                  value={reservationName}
                  onChange={(e) => setReservationName(e.target.value)}
                  placeholder="Guest name"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Guests</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Arrival</Label>
                  <Select value={arrivalTime} onValueChange={handleArrivalChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PUB_HOURS.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Departure</Label>
                  <Select value={departureTime} onValueChange={handleDepartureChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PUB_HOURS.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedTable && (
                <div className="rounded-lg bg-primary/10 p-3 text-sm">
                  Selected: <strong>Table {selectedTable.tableNumber}</strong> ({selectedTable.seats} seats)
                </div>
              )}

              <div className="space-y-2">
                <Label>Comment (optional)</Label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Special requests..."
                  rows={2}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading || !selectedTableId}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create & Approve Booking
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Canvas */}
        <div>
          <p className="text-sm text-muted-foreground mb-3">Click a table to select it</p>
          <FloorPlanCanvas
            mode="booking"
            tables={tables}
            visualElements={elements}
            tableStatuses={tableStatuses}
            selectedTableId={selectedTableId}
            onTableSelect={setSelectedTableId}
          />
        </div>
      </div>
    </div>
  );
}
