"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { PUB_HOURS } from "@/lib/constants";
import { useVoiceRecognition } from "@/hooks/useVoiceRecognition";
import { parseBookingFromText, type ParsedBooking } from "@/lib/voice-parser";
import {
  Mic,
  MicOff,
  Square,
  Loader2,
  Check,
  RotateCcw,
  User,
  Users,
  CalendarDays,
  Clock,
  MapPin,
  AlertCircle,
} from "lucide-react";
import type { PubTable } from "@/types";

export default function MobileVoiceBookPage() {
  const [parsed, setParsed] = useState<ParsedBooking>({});
  const [tables, setTables] = useState<PubTable[]>([]);
  const [floorPlanId, setFloorPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleVoiceResult = useCallback((transcript: string) => {
    const result = parseBookingFromText(transcript);
    setParsed(result);
  }, []);

  const {
    state,
    transcript,
    interimTranscript,
    error: voiceError,
    isSupported,
    startListening,
    stopListening,
    reset: resetVoice,
  } = useVoiceRecognition({ onResult: handleVoiceResult });

  useEffect(() => {
    fetch("/api/floor-plan")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setFloorPlanId(data.id);
          setTables(data.tables || []);
        }
      })
      .catch(console.error);
  }, []);

  // Find matching table by number
  const matchedTable = parsed.tableNumber
    ? tables.find(
        (t) =>
          t.tableNumber.toLowerCase() === parsed.tableNumber!.toLowerCase() ||
          t.tableNumber.toLowerCase() === `t${parsed.tableNumber!.toLowerCase()}`
      )
    : null;

  const today = new Date().toISOString().split("T")[0];

  // Editable fields (prefilled from voice)
  const [editName, setEditName] = useState("");
  const [editGuests, setEditGuests] = useState("2");
  const [editDate, setEditDate] = useState(today);
  const [editArrival, setEditArrival] = useState("19:00");
  const [editDeparture, setEditDeparture] = useState("21:00");
  const [editTableId, setEditTableId] = useState<string | null>(null);

  // Sync parsed results into editable fields
  useEffect(() => {
    if (parsed.name) setEditName(parsed.name);
    if (parsed.guestCount) setEditGuests(String(parsed.guestCount));
    if (parsed.date) setEditDate(parsed.date);
    if (parsed.arrivalTime) setEditArrival(parsed.arrivalTime);
    if (parsed.departureTime) setEditDeparture(parsed.departureTime);
    if (matchedTable) setEditTableId(matchedTable.id);
  }, [parsed, matchedTable]);

  const handleToggleRecording = () => {
    if (state === "listening") {
      stopListening();
    } else {
      resetVoice();
      setParsed({});
      setSubmitted(false);
      startListening();
    }
  };

  const handleReset = () => {
    resetVoice();
    setParsed({});
    setEditName("");
    setEditGuests("2");
    setEditDate(today);
    setEditArrival("19:00");
    setEditDeparture("21:00");
    setEditTableId(null);
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!editName.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (!editTableId) {
      toast({ title: "Please select a table", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: editTableId,
          reservationName: editName.trim(),
          guestCount: parseInt(editGuests),
          bookingDate: editDate,
          arrivalTime: editArrival,
          departureTime: editDeparture,
        }),
      });

      if (res.ok) {
        const booking = await res.json();
        await fetch(`/api/bookings/${booking.id}/approve`, { method: "POST" });
        toast({ title: "Booking created & approved!" });
        setSubmitted(true);
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to create", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to create booking", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Voice Not Supported</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Your browser does not support the Web Speech API. Please use Chrome or Safari on your mobile device.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
          <Check className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-lg font-semibold">Booking Confirmed!</h2>
        <p className="text-sm text-muted-foreground">
          {editName} - Table {tables.find((t) => t.id === editTableId)?.tableNumber} at {editArrival}
        </p>
        <Button onClick={handleReset} variant="outline">
          <RotateCcw className="h-4 w-4 mr-2" /> New Booking
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Voice Booking</h1>
        <p className="text-xs text-muted-foreground">
          Press the microphone and say the booking details
        </p>
      </div>

      {/* Record button */}
      <div className="flex flex-col items-center py-4">
        <button
          onClick={handleToggleRecording}
          className={`flex h-24 w-24 items-center justify-center rounded-full transition-all shadow-lg ${
            state === "listening"
              ? "bg-red-500 animate-pulse shadow-red-500/30"
              : "bg-primary hover:bg-primary/90 shadow-primary/30"
          }`}
        >
          {state === "listening" ? (
            <Square className="h-8 w-8 text-white" fill="white" />
          ) : (
            <Mic className="h-10 w-10 text-white" />
          )}
        </button>
        <p className="mt-3 text-sm text-muted-foreground">
          {state === "listening" ? "Listening... tap to stop" : "Tap to start recording"}
        </p>
      </div>

      {/* Transcript */}
      {(transcript || interimTranscript) && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Transcript</p>
            <p className="text-sm">
              {transcript}
              {interimTranscript && (
                <span className="text-muted-foreground italic"> {interimTranscript}</span>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {voiceError && (
        <p className="text-xs text-destructive text-center">{voiceError}</p>
      )}

      {/* Parsed fields — editable */}
      {transcript && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Booking Details</p>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
            </Button>
          </div>

          <Card>
            <CardContent className="p-3 space-y-3">
              {/* Name */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <User className="h-3 w-3" /> Name
                  {parsed.name && <Badge variant="secondary" className="text-[9px] h-4 ml-1">voice</Badge>}
                </Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Guest name"
                  className="h-10"
                />
              </div>

              {/* Guests */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Users className="h-3 w-3" /> Guests
                  {parsed.guestCount && <Badge variant="secondary" className="text-[9px] h-4 ml-1">voice</Badge>}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={editGuests}
                  onChange={(e) => setEditGuests(e.target.value)}
                  className="h-10"
                />
              </div>

              {/* Date */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Date
                  {parsed.date && <Badge variant="secondary" className="text-[9px] h-4 ml-1">voice</Badge>}
                </Label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="h-10"
                />
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Arrival
                    {parsed.arrivalTime && <Badge variant="secondary" className="text-[9px] h-4 ml-1">voice</Badge>}
                  </Label>
                  <select
                    value={editArrival}
                    onChange={(e) => setEditArrival(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {PUB_HOURS.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Departure
                    {parsed.departureTime && <Badge variant="secondary" className="text-[9px] h-4 ml-1">voice</Badge>}
                  </Label>
                  <select
                    value={editDeparture}
                    onChange={(e) => setEditDeparture(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {PUB_HOURS.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table selection */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Table
                  {parsed.tableNumber && <Badge variant="secondary" className="text-[9px] h-4 ml-1">voice</Badge>}
                </Label>
                <select
                  value={editTableId || ""}
                  onChange={(e) => setEditTableId(e.target.value || null)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select a table...</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.tableNumber} ({t.seats} seats)
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Button
            className="w-full h-12"
            onClick={handleSubmit}
            disabled={loading || !editName.trim() || !editTableId}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Confirm & Approve Booking
          </Button>
        </div>
      )}
    </div>
  );
}
