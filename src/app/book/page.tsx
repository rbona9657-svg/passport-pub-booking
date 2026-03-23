"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { PUB_HOURS } from "@/lib/constants";
import { CalendarDays, Clock, Users, MapPin, Loader2, LogIn, MessageSquare } from "lucide-react";
import type { PubTable, VisualElement } from "@/types";

const FloorPlanCanvas = dynamic(() => import("@/components/canvas/FloorPlanCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[400px] bg-muted/30 rounded-xl border border-border/40">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function BookPage() {
  const { data: session } = useSession();
  const [tables, setTables] = useState<PubTable[]>([]);
  const [elements, setElements] = useState<VisualElement[]>([]);
  const [floorPlanId, setFloorPlanId] = useState<string | null>(null);
  const [tableStatuses, setTableStatuses] = useState<Record<string, "available" | "pending" | "booked">>({});
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split("T")[0]);
  const [arrivalTime, setArrivalTime] = useState("19:00");
  const [departureTime, setDepartureTime] = useState("21:00");
  const [reservationName, setReservationName] = useState("");
  const [guestCount, setGuestCount] = useState("2");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  // Load floor plan
  useEffect(() => {
    fetch("/api/floor-plan")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.tables) {
          setFloorPlanId(data.id);
          setTables(data.tables || []);
          setElements(data.visualElements || []);
        }
      })
      .catch(console.error);
  }, []);

  // Load availability when date/time changes
  useEffect(() => {
    if (!floorPlanId) return;
    fetch(
      `/api/tables/availability?floorPlanId=${floorPlanId}&date=${bookingDate}&arrival=${arrivalTime}&departure=${departureTime}`
    )
      .then((res) => res.json())
      .then((data) => {
        setTableStatuses(data);
        // Deselect if table became unavailable
        if (selectedTableId && data[selectedTableId] === "booked") {
          setSelectedTableId(null);
        }
      })
      .catch(console.error);
  }, [floorPlanId, bookingDate, arrivalTime, departureTime, selectedTableId]);

  const selectedTable = tables.find((t) => t.id === selectedTableId);
  const today = new Date().toISOString().split("T")[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTableId) return;

    setLoading(true);
    try {
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
        setSubmitted(true);
        toast({ title: "Booking submitted!", description: "We'll notify you once it's confirmed." });
        // Refresh availability
        const statusRes = await fetch(
          `/api/tables/availability?floorPlanId=${floorPlanId}&date=${bookingDate}&arrival=${arrivalTime}&departure=${departureTime}`
        );
        if (statusRes.ok) setTableStatuses(await statusRes.json());
      } else {
        const data = await res.json();
        toast({
          title: "Booking failed",
          description: typeof data.error === "string" ? data.error : "Please try again",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleTableSelect = (tableId: string) => {
    const status = tableStatuses[tableId];
    if (status === "booked") return;
    setSelectedTableId(tableId === selectedTableId ? null : tableId);
    setSubmitted(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Book a Table</h1>
          <p className="text-muted-foreground mt-1">
            Select your date, time, and pick a table from our floor plan
          </p>
        </div>

        {/* Date & Time Selection */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Date
                </Label>
                <Input
                  type="date"
                  value={bookingDate}
                  min={today}
                  onChange={(e) => setBookingDate(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Arrival
                </Label>
                <Select value={arrivalTime} onValueChange={setArrivalTime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PUB_HOURS.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Departure
                </Label>
                <Select value={departureTime} onValueChange={setDepartureTime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PUB_HOURS.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-green-500" /> Available
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-yellow-500" /> Pending
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500" /> Booked
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-blue-500" /> Selected
          </span>
        </div>

        {/* Floor Plan */}
        <div className="mb-6">
          <FloorPlanCanvas
            mode="booking"
            tables={tables}
            visualElements={elements}
            tableStatuses={tableStatuses}
            selectedTableId={selectedTableId}
            onTableSelect={handleTableSelect}
          />
        </div>

        {/* Booking Form */}
        {selectedTable && !submitted && (
          <Card className="border-primary/30 shadow-lg animate-in slide-in-from-bottom-4 duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-primary" />
                Table {selectedTable.tableNumber} ({selectedTable.seats} seats)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!session ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4">Sign in to complete your booking</p>
                  <Link href={`/auth/signin?callbackUrl=/book`}>
                    <Button>
                      <LogIn className="h-4 w-4 mr-2" />
                      Sign In to Book
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Reservation Name</Label>
                      <Input
                        value={reservationName}
                        onChange={(e) => setReservationName(e.target.value)}
                        placeholder="Your name"
                        required
                        minLength={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Number of Guests
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        max={selectedTable.seats}
                        value={guestCount}
                        onChange={(e) => setGuestCount(e.target.value)}
                        required
                      />
                      <p className="text-xs text-muted-foreground">Max {selectedTable.seats} for this table</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Special Requests (optional)
                    </Label>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Birthday celebration, dietary requirements, etc."
                      rows={2}
                      maxLength={500}
                    />
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Submit Booking Request
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        {submitted && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
                <CalendarDays className="h-7 w-7 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold">Booking Submitted!</h3>
              <p className="text-muted-foreground mt-2">
                Your booking request has been received. We'll review it and send you an email confirmation shortly.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="outline" onClick={() => { setSubmitted(false); setSelectedTableId(null); }}>
                  Book Another Table
                </Button>
                <Link href="/my-bookings">
                  <Button>View My Bookings</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
