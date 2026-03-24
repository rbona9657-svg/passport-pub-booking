"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { PUB_HOURS } from "@/lib/constants";
import {
  CalendarDays,
  Clock,
  Users,
  User,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
} from "lucide-react";
import type { PubTable, VisualElement } from "@/types";

const FloorPlanCanvas = dynamic(() => import("@/components/canvas/FloorPlanCanvas"), {
  ssr: false,
  loading: () => <div className="h-[300px] bg-muted/30 rounded-xl animate-pulse" />,
});

type Step = "datetime" | "table" | "details" | "confirm";
const steps: Step[] = ["datetime", "table", "details", "confirm"];

export default function MobileQuickBookPage() {
  const [step, setStep] = useState<Step>("datetime");
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
  const stepIndex = steps.indexOf(step);

  const goNext = () => {
    const next = steps[stepIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = steps[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const handleSubmit = async () => {
    if (!selectedTableId || !reservationName.trim()) return;
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
        // Reset
        setStep("datetime");
        setReservationName("");
        setGuestCount("2");
        setComment("");
        setSelectedTableId(null);

        // Refresh availability
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
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Quick Book</h1>
        <p className="text-xs text-muted-foreground">Record a phone or walk-in booking</p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= stepIndex ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Step: Date & Time */}
      {step === "datetime" && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarDays className="h-4 w-4 text-primary" />
              Date & Time
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Arrival</Label>
                  <select
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {PUB_HOURS.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Departure</Label>
                  <select
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {PUB_HOURS.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <Button className="w-full h-11" onClick={goNext}>
              Select Table <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step: Table Selection */}
      {step === "table" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-primary" />
            Select a Table
          </div>
          <p className="text-xs text-muted-foreground">
            Tap an available (green) table. {bookingDate} / {arrivalTime}-{departureTime}
          </p>

          <FloorPlanCanvas
            mode="booking"
            tables={tables}
            visualElements={elements}
            tableStatuses={tableStatuses}
            selectedTableId={selectedTableId}
            onTableSelect={setSelectedTableId}
          />

          {selectedTable && (
            <div className="rounded-lg bg-primary/10 p-3 text-sm">
              Selected: <strong>Table {selectedTable.tableNumber}</strong> ({selectedTable.seats} seats)
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-11" onClick={goBack}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button className="flex-1 h-11" onClick={goNext} disabled={!selectedTableId}>
              Guest Details <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Guest Details */}
      {step === "details" && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4 text-primary" />
              Guest Details
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name *</Label>
                <Input
                  value={reservationName}
                  onChange={(e) => setReservationName(e.target.value)}
                  placeholder="Guest name"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Number of Guests</Label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    onClick={() => setGuestCount(String(Math.max(1, parseInt(guestCount) - 1)))}
                  >
                    -
                  </Button>
                  <div className="flex-1 text-center">
                    <span className="text-2xl font-semibold">{guestCount}</span>
                    <span className="text-xs text-muted-foreground ml-1">guests</span>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    onClick={() => setGuestCount(String(Math.min(20, parseInt(guestCount) + 1)))}
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Special requests..."
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11" onClick={goBack}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button className="flex-1 h-11" onClick={goNext} disabled={!reservationName.trim()}>
                Review <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Confirm */}
      {step === "confirm" && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Check className="h-4 w-4 text-primary" />
              Review Booking
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Name
                </span>
                <span className="font-medium">{reservationName}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Date
                </span>
                <span className="font-medium">{bookingDate}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Time
                </span>
                <span className="font-medium">{arrivalTime} - {departureTime}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Table
                </span>
                <span className="font-medium">
                  Table {selectedTable?.tableNumber} ({selectedTable?.seats} seats)
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Guests
                </span>
                <span className="font-medium">{guestCount}</span>
              </div>
              {comment && (
                <div className="flex items-start justify-between py-2">
                  <span className="text-muted-foreground">Notes</span>
                  <span className="font-medium text-right max-w-[60%]">{comment}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11" onClick={goBack}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button className="flex-1 h-11" onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Confirm & Approve
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
