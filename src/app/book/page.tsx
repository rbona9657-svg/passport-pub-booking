"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parse } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { PUB_HOURS } from "@/lib/constants";
import { toMinutesSinceOpen } from "@/lib/validations";
import {
  CalendarDays,
  Clock,
  Users,
  MapPin,
  Loader2,
  MessageSquare,
  Mail,
  User,
  AlertTriangle,
  Info,
  ClipboardList,
  Combine,
  ArrowRight,
} from "lucide-react";
import type { PubTable, VisualElement } from "@/types";

type PubHour = typeof PUB_HOURS[number];

const FloorPlanCanvas = dynamic(() => import("@/components/canvas/FloorPlanCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[400px] bg-muted/30 rounded-xl border border-border/40">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function BookPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <BookPage />
    </Suspense>
  );
}

function BookPage() {
  const searchParams = useSearchParams();

  // Read date from URL params (e.g. /book?date=2026-04-07)
  // Passed from the Passport Pub website match cards via iframe
  const paramDate = searchParams.get("date"); // YYYY-MM-DD

  const [tables, setTables] = useState<PubTable[]>([]);
  const [elements, setElements] = useState<VisualElement[]>([]);
  const [floorPlanId, setFloorPlanId] = useState<string | null>(null);
  const [viewportCrop, setViewportCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [tableStatuses, setTableStatuses] = useState<Record<string, "available" | "pending" | "booked">>({});
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState(() => {
    if (paramDate) {
      const [y, m, d] = paramDate.split("-").map(Number);
      if (y && m && d) return paramDate;
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [arrivalTime, setArrivalTime] = useState<PubHour>("19:00");
  const [departureTime, setDepartureTime] = useState<PubHour>("21:00");
  const [reservationName, setReservationName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestCount, setGuestCount] = useState("2");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [capacityWarning, setCapacityWarning] = useState<string | null>(null);
  // Large party combo state
  const [largePartyCombo, setLargePartyCombo] = useState<Array<{ id: string; tableNumber: string; seats: number; guestAlloc: number }> | null>(null);
  const [pendingComboTables, setPendingComboTables] = useState<Array<{ id: string; tableNumber: string; seats: number; guestAlloc: number }>>([]);
  const [comboGroupId, setComboGroupId] = useState<string | null>(null);
  const [originalGuestCount, setOriginalGuestCount] = useState<number | null>(null);

  const [duplicateWarning, setDuplicateWarning] = useState<{
    existingBookings: Array<{
      id: string;
      arrivalTime: string;
      departureTime: string;
      guestCount: number;
      status: string;
      tableNumber: string;
    }>;
    bookingDate: string;
    hasTimeOverlap?: boolean;
  } | null>(null);
  const { toast } = useToast();

  // Sync URL date param to state — handles late param availability and Suspense re-mounts
  const paramsAppliedRef = useRef(false);
  useEffect(() => {
    if (paramsAppliedRef.current || !paramDate) return;
    paramsAppliedRef.current = true;
    const [y, m, d] = paramDate.split("-").map(Number);
    if (y && m && d) {
      setBookingDate(paramDate);
    }
  }, [paramDate]);

  const handleArrivalChange = (val: string) => {
    const hour = val as PubHour;
    setArrivalTime(hour);
    if (toMinutesSinceOpen(departureTime) <= toMinutesSinceOpen(hour)) {
      const idx = PUB_HOURS.indexOf(hour);
      if (idx >= 0 && idx < PUB_HOURS.length - 1) {
        setDepartureTime(PUB_HOURS[idx + 1]);
      }
    }
  };

  const handleDepartureChange = (val: string) => {
    const hour = val as PubHour;
    setDepartureTime(hour);
    if (toMinutesSinceOpen(hour) <= toMinutesSinceOpen(arrivalTime)) {
      const idx = PUB_HOURS.indexOf(hour);
      if (idx > 0) {
        setArrivalTime(PUB_HOURS[idx - 1]);
      }
    }
  };

  // Load floor plan
  useEffect(() => {
    fetch("/api/floor-plan")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.tables) {
          setFloorPlanId(data.id);
          setTables(data.tables || []);
          setElements(data.visualElements || []);
          if (data.viewportConfig?.crop) {
            setViewportCrop(data.viewportConfig.crop);
          }
        }
      })
      .catch(console.error);
  }, []);

  // Keep a ref to selectedTableId so the availability effect can read it without re-triggering
  const selectedTableRef = useRef(selectedTableId);
  selectedTableRef.current = selectedTableId;

  // Load availability when date/time changes
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
        if (data && !data.error) {
          setTableStatuses(data);
          if (selectedTableRef.current && data[selectedTableRef.current] === "booked") {
            setSelectedTableId(null);
          }
        }
      })
      .catch(console.error);
  }, [floorPlanId, bookingDate, arrivalTime, departureTime]);

  const selectedTable = tables.find((t) => t.id === selectedTableId);
  const maxTableCapacity = tables.length > 0 ? Math.max(...tables.map((t) => t.seats)) : 0;
  const guestCountNum = parseInt(guestCount) || 0;
  const needsMultipleTables = maxTableCapacity > 0 && guestCountNum > maxTableCapacity;
  const tablesNeeded = maxTableCapacity > 0 ? Math.ceil(guestCountNum / maxTableCapacity) : 0;

  // Check capacity when guest count or selected table changes
  useEffect(() => {
    if (selectedTable && parseInt(guestCount) > selectedTable.seats) {
      setCapacityWarning(
        `Table ${selectedTable.tableNumber} only has ${selectedTable.seats} seats, but you need seating for ${guestCount} guests. Please choose a larger table or book additional tables.`
      );
    } else {
      setCapacityWarning(null);
    }
  }, [guestCount, selectedTable]);

  // Detect large party: guest count exceeds ALL available tables
  useEffect(() => {
    const count = parseInt(guestCount);
    if (isNaN(count) || count <= 0 || tables.length === 0 || pendingComboTables.length > 0) {
      if (pendingComboTables.length === 0) setLargePartyCombo(null);
      return;
    }

    const availableTables = tables
      .filter((t) => tableStatuses[t.id] === "available")
      .sort((a, b) => b.seats - a.seats);

    const maxSeats = availableTables.length > 0 ? availableTables[0].seats : 0;

    if (count <= maxSeats) {
      setLargePartyCombo(null);
      return;
    }

    // Greedy: pick largest tables until sum >= count
    const combo: typeof largePartyCombo = [];
    let remaining = count;
    for (const t of availableTables) {
      if (remaining <= 0) break;
      const alloc = Math.min(t.seats, remaining);
      combo.push({ id: t.id, tableNumber: t.tableNumber, seats: t.seats, guestAlloc: alloc });
      remaining -= alloc;
    }

    if (remaining > 0) {
      // Not enough tables at all
      setLargePartyCombo(null);
      setCapacityWarning(`We don't have enough available tables to seat ${count} guests at this time. Please try a different date or time.`);
    } else {
      setLargePartyCombo(combo);
      // Clear the single-table capacity warning since we're showing combo
      if (!selectedTable) setCapacityWarning(null);
    }
  }, [guestCount, tables, tableStatuses, selectedTable, pendingComboTables.length]);

  const submitBooking = async (forceSubmit = false) => {
    if (!selectedTableId || capacityWarning) return;

    setLoading(true);
    setDuplicateWarning(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: selectedTableId,
          reservationName,
          guestEmail,
          guestCount: parseInt(guestCount),
          bookingDate,
          arrivalTime,
          departureTime,
          comment: comment || null,
          forceSubmit,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        setDuplicateWarning(null);
        toast({ title: "Booking submitted!", description: "Check your email for confirmation details." });
        const statusRes = await fetch(
          `/api/tables/availability?floorPlanId=${floorPlanId}&date=${bookingDate}&arrival=${arrivalTime}&departure=${departureTime}`
        );
        if (statusRes.ok) setTableStatuses(await statusRes.json());
      } else if (res.status === 409) {
        const data = await res.json();
        if (data.error === "duplicate_booking") {
          setDuplicateWarning({
            existingBookings: data.existingBookings,
            bookingDate: data.bookingDate,
            hasTimeOverlap: data.hasTimeOverlap,
          });
        }
      } else {
        const data = await res.json();
        let errorMsg = "Please try again";
        if (typeof data.error === "string") {
          errorMsg = data.error;
        } else if (data.error?.fieldErrors) {
          const fields = data.error.fieldErrors;
          errorMsg = Object.values(fields).flat().join(". ");
        }
        toast({
          title: "Booking failed",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitBooking(false);
  };

  const handleForceSubmit = async () => {
    await submitBooking(true);
  };

  const startComboBooking = (combo: NonNullable<typeof largePartyCombo>) => {
    const totalGuests = parseInt(guestCount);
    setOriginalGuestCount(totalGuests);
    const groupId = crypto.randomUUID();
    setComboGroupId(groupId);
    setPendingComboTables(combo.slice(1)); // remaining tables after the first
    setLargePartyCombo(null);

    // Auto-select first table
    const first = combo[0];
    setSelectedTableId(first.id);
    setGuestCount(String(first.guestAlloc));
    setComment(`Merged tables for ${totalGuests} guests (1/${combo.length}) [GROUP:${groupId}]`);
  };

  const continueComboBooking = () => {
    const next = pendingComboTables[0];
    const remaining = pendingComboTables.slice(1);
    const totalTables = (originalGuestCount ? Math.ceil(originalGuestCount / (next?.seats || 1)) : 0) || pendingComboTables.length + 1;
    const currentIndex = totalTables - pendingComboTables.length + 1;

    setPendingComboTables(remaining);
    setSubmitted(false);
    setSelectedTableId(next.id);
    setGuestCount(String(next.guestAlloc));
    setComment(`Merged tables for ${originalGuestCount} guests (${currentIndex}/${totalTables}) [GROUP:${comboGroupId}]`);
  };

  const handleTableSelect = (tableId: string) => {
    const status = tableStatuses[tableId];
    if (status === "booked") return;
    setSelectedTableId(tableId === selectedTableId ? null : tableId);
    setSubmitted(false);
    setCapacityWarning(null);
    setDuplicateWarning(null);
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal h-9"
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {bookingDate
                        ? format(parse(bookingDate, "yyyy-MM-dd", new Date()), "PPP")
                        : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      selected={bookingDate ? parse(bookingDate, "yyyy-MM-dd", new Date()) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setBookingDate(format(date, "yyyy-MM-dd"));
                        }
                      }}
                      fromDate={new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex-1 space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Arrival
                </Label>
                <Select value={arrivalTime} onValueChange={handleArrivalChange}>
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
                <Select value={departureTime} onValueChange={handleDepartureChange}>
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
                  <Users className="h-4 w-4" />
                  Guests
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 text-xs sm:text-sm">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-green-500" /> Available
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-yellow-500" /> Pending Approval
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500" /> Booked
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-blue-500" /> Selected
          </span>
        </div>

        {/* Multiple Tables Suggestion */}
        {needsMultipleTables && !largePartyCombo && (
          <Card className="mb-6 border-blue-500/40 bg-blue-500/5 animate-in slide-in-from-top-4 duration-300">
            <CardContent className="py-5">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15">
                    <Info className="h-5 w-5 text-blue-400" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-200">Large Party? No Problem!</h3>
                  <p className="text-sm text-blue-300/80 mt-1">
                    For {guestCountNum} guests, we recommend booking {tablesNeeded} tables.
                    Our largest table seats {maxTableCapacity}. Simply book {tablesNeeded} separate tables
                    and our staff will combine them before your arrival so your group
                    can sit together.
                  </p>
                  <p className="text-xs text-blue-300/60 mt-2">
                    Tip: Mention &quot;combined tables&quot; in the Special Requests field of each booking.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Floor Plan */}
        <div className="mb-6">
          <FloorPlanCanvas
            mode="booking"
            tables={tables}
            visualElements={elements}
            tableStatuses={tableStatuses}
            selectedTableId={selectedTableId}
            onTableSelect={handleTableSelect}
            viewportCrop={viewportCrop}
          />
        </div>

        {/* Capacity Warning */}
        {capacityWarning && selectedTable && (
          <Card className="mb-6 border-amber-500/40 bg-amber-500/5 animate-in slide-in-from-bottom-4 duration-300">
            <CardContent className="py-5">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-amber-200">Not Enough Seats</h3>
                  <p className="text-sm text-amber-300/80 mt-1">{capacityWarning}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Large Party Combo Suggestion */}
        {largePartyCombo && largePartyCombo.length > 0 && !selectedTable && (
          <Card className="mb-6 border-blue-500/40 bg-blue-500/5 animate-in slide-in-from-bottom-4 duration-300">
            <CardContent className="py-5">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15">
                    <Combine className="h-5 w-5 text-blue-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-200">{guestCount} guests? We&apos;ll push tables together!</h3>
                  <p className="text-sm text-blue-300/80 mt-1">
                    No single table fits your group, but our staff will physically merge tables for you. We recommend booking {largePartyCombo.length} tables:
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {largePartyCombo.map((t, i) => (
                      <div key={t.id} className="text-sm text-blue-300/90 flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium">{i + 1}</span>
                        Table {t.tableNumber} — {t.guestAlloc} of {t.seats} seats
                      </div>
                    ))}
                    <div className="text-sm text-blue-200 font-medium mt-2">
                      Total: {largePartyCombo.reduce((sum, t) => sum + t.guestAlloc, 0)} seats for {guestCount} guests
                    </div>
                  </div>
                  <p className="text-xs text-blue-300/60 mt-3">
                    You&apos;ll submit {largePartyCombo.length} separate bookings — we&apos;ll guide you through each one. Add your name and email once, and we&apos;ll pre-fill the rest.
                  </p>
                  <Button
                    size="sm"
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => startComboBooking(largePartyCombo)}
                  >
                    <ArrowRight className="h-4 w-4 mr-1.5" />
                    Start Booking ({largePartyCombo.length} tables)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Combo Progress Indicator */}
        {pendingComboTables.length > 0 && !submitted && (
          <div className="mb-4 flex items-center gap-2 text-sm text-blue-300/80">
            <Combine className="h-4 w-4" />
            Merged table booking — {pendingComboTables.length} table{pendingComboTables.length > 1 ? "s" : ""} remaining after this one
          </div>
        )}

        {/* Duplicate Booking Warning */}
        {duplicateWarning && (
          <Card className="mb-6 border-amber-500/40 bg-amber-500/5 animate-in slide-in-from-bottom-4 duration-300">
            <CardContent className="py-5">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15">
                    <ClipboardList className="h-5 w-5 text-amber-500" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-200">
                    {duplicateWarning.hasTimeOverlap
                      ? "Time conflict with your existing booking!"
                      : "You already have a booking on this date!"}
                  </h3>
                  <p className="text-sm text-amber-300/80 mt-1">
                    {duplicateWarning.hasTimeOverlap
                      ? "Your new booking overlaps with an existing one:"
                      : `We found ${duplicateWarning.existingBookings.length} existing booking${duplicateWarning.existingBookings.length > 1 ? "s" : ""} for ${duplicateWarning.bookingDate}:`}
                  </p>
                  <div className="mt-2 space-y-1">
                    {duplicateWarning.existingBookings.map((b) => (
                      <div key={b.id} className="text-sm text-amber-300/90 flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5" />
                        {b.arrivalTime}–{b.departureTime} &middot; Table {b.tableNumber} ({b.guestCount} guests) &middot;{" "}
                        <span className={b.status === "approved" ? "text-green-400" : "text-yellow-400"}>
                          {b.status === "approved" ? "Confirmed" : "Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
                      onClick={() => window.location.href = "/my-bookings"}
                    >
                      <ClipboardList className="h-4 w-4 mr-1.5" />
                      Manage My Bookings
                    </Button>
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={handleForceSubmit}
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                      Book Another Table Anyway
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Your Name
                    </Label>
                    <Input
                      value={reservationName}
                      onChange={(e) => setReservationName(e.target.value)}
                      placeholder="Name for the reservation"
                      required
                      minLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email Address
                    </Label>
                    <Input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                    />
                    <p className="text-xs text-muted-foreground">Confirmation will be sent here</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Number of Guests
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={guestCount}
                      onChange={(e) => setGuestCount(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">This table seats {selectedTable.seats}</p>
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
                </div>
                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={loading || !!capacityWarning}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Submit Booking Request
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {submitted && (
          <Card className={pendingComboTables.length > 0 ? "border-blue-500/30 bg-blue-500/5" : "border-green-500/30 bg-green-500/5"}>
            <CardContent className="py-8 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/booking-success.svg" alt="" className="mx-auto mb-4 h-24 w-24" />
              <h3 className="text-lg font-semibold">Booking Submitted!</h3>
              <p className="text-muted-foreground mt-2">
                Your booking request has been received. We&apos;ll review it and send a confirmation to <strong className="text-foreground">{guestEmail}</strong> once approved.
              </p>

              {/* Combo continuation CTA */}
              {pendingComboTables.length > 0 ? (
                <div className="mt-6 space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-2 text-sm text-blue-300">
                    <Combine className="h-4 w-4" />
                    {pendingComboTables.length} more table{pendingComboTables.length > 1 ? "s" : ""} to book for your group of {originalGuestCount}!
                  </div>
                  <div>
                    <Button
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={continueComboBooking}
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Continue: Table {pendingComboTables[0].tableNumber} ({pendingComboTables[0].guestAlloc} guests)
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSubmitted(false);
                      setSelectedTableId(null);
                      setReservationName("");
                      setGuestEmail("");
                      setGuestCount("2");
                      setComment("");
                      setOriginalGuestCount(null);
                      setComboGroupId(null);
                    }}
                  >
                    Book Another Table
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
