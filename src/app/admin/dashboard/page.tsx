"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CalendarDays, Clock, Users, Check, X, MessageSquare, Loader2, Mic, CalendarPlus, AlertTriangle, ArrowRight, Lightbulb, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { PubTable, VisualElement } from "@/types";

const FloorPlanCanvas = dynamic(() => import("@/components/canvas/FloorPlanCanvas"), {
  ssr: false,
  loading: () => <div className="h-[280px] bg-muted/30 rounded-xl animate-pulse" />,
});

interface BookingWithDetails {
  id: string;
  reservationName: string;
  guestCount: number;
  guestEmail: string | null;
  bookingDate: string;
  arrivalTime: string;
  departureTime: string;
  status: string;
  comment: string | null;
  createdAt: string;
  tableId: string;
  createdByAdmin?: boolean;
  table: { id?: string; tableNumber: string; seats: number };
  user: { name: string | null; email: string } | null;
}

interface AvailableTable {
  id: string;
  tableNumber: string;
  seats: number;
}

function toLocalDateString(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function groupByTime(bookings: BookingWithDetails[]) {
  const groups: Record<string, BookingWithDetails[]> = {};
  for (const b of bookings) {
    const hour = b.arrivalTime.slice(0, 5);
    if (!groups[hour]) groups[hour] = [];
    groups[hour].push(b);
  }
  return Object.entries(groups).sort(([a], [b]) => {
    const aNum = parseInt(a.replace(":", ""));
    const bNum = parseInt(b.replace(":", ""));
    const aAdj = aNum < 600 ? aNum + 2400 : aNum;
    const bAdj = bNum < 600 ? bNum + 2400 : bNum;
    return aAdj - bAdj;
  });
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  approved: "bg-green-500/10 text-green-500 border-green-500/30",
  rejected: "bg-red-500/10 text-red-500 border-red-500/30",
  cancelled: "bg-gray-500/10 text-gray-500 border-gray-500/30",
};

export default function AdminDashboard() {
  const [pendingBookings, setPendingBookings] = useState<BookingWithDetails[]>([]);
  const [todayBookings, setTodayBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayLoading, setTodayLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [approveBooking, setApproveBooking] = useState<BookingWithDetails | null>(null);
  const [approveTableId, setApproveTableId] = useState<string>("");
  const [approveAdminNote, setApproveAdminNote] = useState("");
  const [availableTables, setAvailableTables] = useState<AvailableTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [cardTableOverrides, setCardTableOverrides] = useState<Record<string, string>>({});
  const [expandedReassign, setExpandedReassign] = useState<string | null>(null);
  const [cardAvailableTables, setCardAvailableTables] = useState<Record<string, AvailableTable[]>>({});
  // Floor plan state
  const [floorTables, setFloorTables] = useState<PubTable[]>([]);
  const [floorElements, setFloorElements] = useState<VisualElement[]>([]);
  const [viewportCrop, setViewportCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [tableStatuses, setTableStatuses] = useState<Record<string, "available" | "pending" | "booked">>({});
  const { toast } = useToast();

  const today = toLocalDateString(new Date());
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDateString(d);
  })();

  const fetchPendingBookings = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings?status=pending");
      if (res.ok) {
        const data = await res.json();
        setPendingBookings(data);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load bookings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchTodayBookings = useCallback(async () => {
    setTodayLoading(true);
    try {
      // Fetch today's bookings + yesterday's (to catch overnight bookings)
      const [todayRes, yesterdayRes] = await Promise.all([
        fetch(`/api/bookings?date=${today}`),
        fetch(`/api/bookings?date=${yesterday}`),
      ]);
      let merged: BookingWithDetails[] = [];
      if (todayRes.ok) {
        merged = await todayRes.json();
      }
      // Add yesterday's bookings that cross midnight (arrivalTime > departureTime)
      if (yesterdayRes.ok) {
        const yesterdayData: BookingWithDetails[] = await yesterdayRes.json();
        const overnight = yesterdayData.filter(
          (b) => b.arrivalTime > b.departureTime
        );
        // Avoid duplicates
        const todayIds = new Set(merged.map((b) => b.id));
        for (const b of overnight) {
          if (!todayIds.has(b.id)) merged.push(b);
        }
      }
      setTodayBookings(merged);
    } catch {
      // ignore
    } finally {
      setTodayLoading(false);
    }
  }, [today, yesterday]);

  useEffect(() => {
    fetchPendingBookings();
    fetchTodayBookings();
    const interval = setInterval(() => {
      fetchPendingBookings();
      fetchTodayBookings();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchPendingBookings, fetchTodayBookings]);

  // Fetch floor plan
  useEffect(() => {
    fetch("/api/floor-plan")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setFloorTables(data.tables || []);
          setFloorElements(data.visualElements || []);
          if (data.viewportConfig?.crop) {
            setViewportCrop(data.viewportConfig.crop);
          }
        }
      })
      .catch(console.error);
  }, []);

  // Compute table statuses from today's bookings
  useEffect(() => {
    const statusMap: Record<string, "available" | "pending" | "booked"> = {};
    for (const t of floorTables) {
      statusMap[t.id] = "available";
    }
    for (const b of todayBookings) {
      if (b.status === "approved") {
        statusMap[b.tableId] = "booked";
      } else if (b.status === "pending" && statusMap[b.tableId] !== "booked") {
        statusMap[b.tableId] = "pending";
      }
    }
    setTableStatuses(statusMap);
  }, [todayBookings, floorTables]);

  const fetchAvailableTables = async (booking: BookingWithDetails) => {
    setTablesLoading(true);
    try {
      const fpRes = await fetch("/api/floor-plan");
      if (!fpRes.ok) return;
      const fpData = await fpRes.json();
      const floorPlanId = fpData.id;
      const allTables: AvailableTable[] = (fpData.tables || []).map((t: { id: string; tableNumber: string; seats: number }) => ({
        id: t.id, tableNumber: t.tableNumber, seats: t.seats,
      }));
      const res = await fetch(
        `/api/tables/availability?floorPlanId=${floorPlanId}&date=${booking.bookingDate}&arrival=${booking.arrivalTime}&departure=${booking.departureTime}`
      );
      if (!res.ok) return;
      const statusMap = await res.json();
      const currentTableId = booking.table?.id || booking.tableId;
      const available = allTables.filter(
        (t) => statusMap[t.id] === "available" || t.id === currentTableId
      );
      available.sort((a, b) => {
        const aDiff = a.seats - booking.guestCount;
        const bDiff = b.seats - booking.guestCount;
        if (aDiff >= 0 && bDiff >= 0) return aDiff - bDiff;
        if (aDiff >= 0) return -1;
        if (bDiff >= 0) return 1;
        return bDiff - aDiff;
      });
      setAvailableTables(available);
    } catch {
      // silent
    } finally {
      setTablesLoading(false);
    }
  };

  const fetchCardTables = async (booking: BookingWithDetails) => {
    try {
      const fpRes = await fetch("/api/floor-plan");
      if (!fpRes.ok) return;
      const fpData = await fpRes.json();
      const floorPlanId = fpData.id;
      const allTables: AvailableTable[] = (fpData.tables || []).map((t: { id: string; tableNumber: string; seats: number }) => ({
        id: t.id, tableNumber: t.tableNumber, seats: t.seats,
      }));
      const res = await fetch(
        `/api/tables/availability?floorPlanId=${floorPlanId}&date=${booking.bookingDate}&arrival=${booking.arrivalTime}&departure=${booking.departureTime}`
      );
      if (!res.ok) return;
      const statusMap = await res.json();
      const currentTableId = booking.table?.id || booking.tableId;
      const available = allTables
        .filter((t) => (statusMap[t.id] === "available" || t.id === currentTableId) && t.seats >= booking.guestCount)
        .sort((a, b) => a.seats - b.seats);
      setCardAvailableTables((prev) => ({ ...prev, [booking.id]: available }));
    } catch { /* silent */ }
  };

  const toggleReassign = (booking: BookingWithDetails) => {
    if (expandedReassign === booking.id) {
      setExpandedReassign(null);
      return;
    }
    setExpandedReassign(booking.id);
    if (!cardAvailableTables[booking.id]) {
      fetchCardTables(booking);
    }
  };

  const openApproveDialog = (booking: BookingWithDetails) => {
    setApproveBooking(booking);
    setApproveTableId(cardTableOverrides[booking.id] || booking.table?.id || booking.tableId);
    setApproveAdminNote("");
    fetchAvailableTables(booking);
  };

  const handleApprove = async () => {
    if (!approveBooking) return;
    const id = approveBooking.id;
    setActionLoading(id);
    try {
      const currentTableId = approveBooking.table?.id || approveBooking.tableId;
      const tableChanged = approveTableId !== currentTableId;
      const res = await fetch(`/api/bookings/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newTableId: tableChanged ? approveTableId : undefined,
          adminNote: approveAdminNote || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.emailSent) {
          toast({
            title: "Booking Approved",
            description: tableChanged
              ? "Table reassigned and confirmation email sent to the guest."
              : "Confirmation email sent to the guest.",
          });
        } else {
          toast({
            title: "Booking Approved",
            description: `Warning: ${data.emailError || "Confirmation email could not be sent."}${tableChanged ? " (Table was reassigned)" : ""}`,
            variant: "destructive",
          });
        }
        setPendingBookings((prev) => prev.filter((b) => b.id !== id));
        fetchTodayBookings();
        setApproveBooking(null);
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to approve", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    setActionLoading(rejectId);
    try {
      const res = await fetch(`/api/bookings/${rejectId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (res.ok) {
        toast({ title: "Booking Rejected", description: "The guest has been notified." });
        setPendingBookings((prev) => prev.filter((b) => b.id !== rejectId));
        fetchTodayBookings();
      }
    } catch {
      toast({ title: "Error", description: "Failed to reject", variant: "destructive" });
    } finally {
      setActionLoading(null);
      setRejectId(null);
      setRejectReason("");
    }
  };

  // Detect merged table groups
  const extractGroupId = (comment: string | null): string | null => {
    if (!comment) return null;
    const match = comment.match(/\[GROUP:([a-f0-9-]+)\]/);
    return match ? match[1] : null;
  };

  const groupCounts = pendingBookings.reduce<Record<string, number>>((acc, b) => {
    const gid = extractGroupId(b.comment);
    if (gid) acc[gid] = (acc[gid] || 0) + 1;
    return acc;
  }, {});

  const getGroupIndex = (booking: BookingWithDetails): { groupId: string; index: number; total: number } | null => {
    const gid = extractGroupId(booking.comment);
    if (!gid || !groupCounts[gid] || groupCounts[gid] < 2) return null;
    const groupBookings = pendingBookings.filter((b) => extractGroupId(b.comment) === gid);
    const idx = groupBookings.findIndex((b) => b.id === booking.id);
    return { groupId: gid, index: idx + 1, total: groupCounts[gid] };
  };

  const pendingCount = pendingBookings.length;

  // Today's active bookings (not cancelled/rejected)
  const todayActive = todayBookings.filter((b) => b.status !== "cancelled" && b.status !== "rejected");
  const todayApproved = todayActive.filter((b) => b.status === "approved").length;
  const todayPending = todayActive.filter((b) => b.status === "pending").length;
  const todayGrouped = groupByTime(todayActive);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview & incoming booking requests</p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/admin/mobile/voice-book">
          <Button size="lg" className="gap-2 w-full sm:w-auto">
            <Mic className="h-5 w-5" />
            Voice Booking
          </Button>
        </Link>
        <Link href="/admin/mobile/quick-book">
          <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
            <CalendarPlus className="h-5 w-5" />
            Quick Booking
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Check className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayApproved}</p>
                <p className="text-sm text-muted-foreground">Today Confirmed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayActive.length}</p>
                <p className="text-sm text-muted-foreground">Today Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Floor Plan */}
      {floorTables.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Today&apos;s Floor Plan</h2>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                {todayApproved} confirmed
              </Badge>
              {todayPending > 0 && (
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                  {todayPending} pending
                </Badge>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <FloorPlanCanvas
              mode="booking"
              tables={floorTables}
              visualElements={floorElements}
              tableStatuses={tableStatuses}
              viewportCrop={viewportCrop}
            />
          </div>
        </div>
      )}

      {/* Today's Bookings Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Today&apos;s Bookings</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchTodayBookings}>
            <RefreshCw className={cn("h-4 w-4", todayLoading && "animate-spin")} />
          </Button>
        </div>
        {todayLoading && todayActive.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : todayActive.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <CalendarDays className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p className="text-muted-foreground">No bookings for today</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {todayGrouped.map(([time, items]) => (
              <div key={time}>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">{time}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((booking) => (
                    <Card key={booking.id} className="overflow-hidden">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium text-sm truncate">{booking.reservationName}</span>
                            <Badge variant="outline" className={cn("text-[10px] shrink-0", statusColors[booking.status])}>
                              {booking.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground ml-2">
                            <span className="font-medium text-foreground">T{booking.table.tableNumber}</span>
                            <span className="flex items-center gap-0.5">
                              <Users className="h-3 w-3" />
                              {booking.guestCount}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{booking.arrivalTime.slice(0, 5)} - {booking.departureTime.slice(0, 5)}</span>
                          {booking.createdByAdmin && <Badge variant="secondary" className="text-[10px] h-4">Admin</Badge>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Bookings */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Pending Bookings</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pendingBookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No pending bookings</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendingBookings.map((booking) => {
              const utilization = Math.round((booking.guestCount / booking.table.seats) * 100);
              const lowUtil = utilization < 50;
              const veryLowUtil = utilization < 25;
              const groupInfo = getGroupIndex(booking);
              return (
                <Card key={booking.id} className={`overflow-hidden ${groupInfo ? "ring-1 ring-blue-500/30" : ""}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{booking.reservationName}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">{booking.guestEmail || booking.user?.email || "No email"}</p>
                      </div>
                      <div className="flex gap-1.5">
                        {groupInfo && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                            Merged {groupInfo.index}/{groupInfo.total}
                          </Badge>
                        )}
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                          Pending
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {booking.bookingDate}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {booking.arrivalTime} - {booking.departureTime}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {booking.guestCount} guests
                      </div>
                      <div className="flex items-center gap-2 font-medium">
                        {(() => {
                          const overrideId = cardTableOverrides[booking.id];
                          const overrideTable = overrideId ? (cardAvailableTables[booking.id] || []).find((t) => t.id === overrideId) : null;
                          if (overrideTable) {
                            return (
                              <>
                                <span className="line-through text-muted-foreground">T{booking.table.tableNumber}</span>
                                <ArrowRight className="h-3 w-3 text-blue-400" />
                                <span className="text-blue-400">T{overrideTable.tableNumber}</span>
                                <span className="text-xs text-muted-foreground">({overrideTable.seats} seats)</span>
                              </>
                            );
                          }
                          return (
                            <>
                              Table {booking.table.tableNumber}
                              <span className="text-xs text-muted-foreground">({booking.table.seats} seats)</span>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Utilization Warning + Inline Reassign */}
                    {lowUtil && (
                      <div className={`flex items-center justify-between gap-2 rounded-lg p-2 text-xs ${veryLowUtil ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>{booking.guestCount}/{booking.table.seats} seats — {utilization}%</span>
                        </div>
                        <button
                          className="text-xs underline hover:no-underline"
                          onClick={() => toggleReassign(booking)}
                        >
                          {expandedReassign === booking.id ? "Close" : "Reassign"}
                        </button>
                      </div>
                    )}

                    {/* Inline Table Reassign Dropdown */}
                    {expandedReassign === booking.id && (
                      <div className="rounded-lg border border-border/40 p-2.5 space-y-2 animate-in slide-in-from-top-2 duration-200">
                        <Label className="text-xs font-medium">Assign to different table</Label>
                        {!cardAvailableTables[booking.id] ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
                          </div>
                        ) : (
                          <Select
                            value={cardTableOverrides[booking.id] || booking.table?.id || booking.tableId}
                            onValueChange={(val) => {
                              setCardTableOverrides((prev) => ({ ...prev, [booking.id]: val }));
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(cardAvailableTables[booking.id] || []).map((t) => {
                                const currentId = booking.table?.id || booking.tableId;
                                const isCurrent = t.id === currentId;
                                return (
                                  <SelectItem key={t.id} value={t.id} className="text-xs">
                                    T{t.tableNumber} ({t.seats} seats){isCurrent ? " — current" : ""}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}

                    {booking.comment && (
                      <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-xs">
                        <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">{booking.comment}</span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => openApproveDialog(booking)}
                        disabled={actionLoading === booking.id}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => setRejectId(booking.id)}
                        disabled={actionLoading === booking.id}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={!!approveBooking} onOpenChange={(open) => !open && setApproveBooking(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Booking</DialogTitle>
          </DialogHeader>
          {approveBooking && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><strong>{approveBooking.reservationName}</strong> — {approveBooking.guestCount} guests</p>
                <p className="text-muted-foreground">{approveBooking.bookingDate} &middot; {approveBooking.arrivalTime}–{approveBooking.departureTime}</p>
              </div>

              {(() => {
                const util = Math.round((approveBooking.guestCount / approveBooking.table.seats) * 100);
                const isLow = util < 50;
                return (
                  <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${isLow ? "bg-amber-500/10 border border-amber-500/20" : "bg-muted/50"}`}>
                    <Users className="h-4 w-4 shrink-0" />
                    <span>
                      Current: Table {approveBooking.table.tableNumber} ({approveBooking.table.seats} seats) —{" "}
                      <strong className={isLow ? "text-amber-400" : ""}>{util}% utilization</strong>
                    </span>
                  </div>
                );
              })()}

              {!tablesLoading && availableTables.length > 0 && (() => {
                const currentId = approveBooking.table?.id || approveBooking.tableId;
                const bestFit = availableTables.find(
                  (t) => t.id !== currentId && t.seats >= approveBooking.guestCount
                );
                if (!bestFit) return null;
                const bestUtil = Math.round((approveBooking.guestCount / bestFit.seats) * 100);
                const currentUtil = Math.round((approveBooking.guestCount / approveBooking.table.seats) * 100);
                if (bestUtil <= currentUtil) return null;
                return (
                  <div className="flex items-start gap-2 rounded-lg p-3 text-sm bg-blue-500/10 border border-blue-500/20">
                    <Lightbulb className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-blue-300 font-medium">Better fit available!</p>
                      <p className="text-blue-300/80 mt-0.5">
                        Table {bestFit.tableNumber} ({bestFit.seats} seats) — {bestUtil}% utilization
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 border-blue-500/30 text-blue-300 hover:bg-blue-500/10"
                        onClick={() => setApproveTableId(bestFit.id)}
                      >
                        <ArrowRight className="h-3.5 w-3.5 mr-1" />
                        Use Table {bestFit.tableNumber}
                      </Button>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2">
                <Label className="text-sm font-medium">Assign Table</Label>
                {tablesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading available tables...
                  </div>
                ) : (
                  <Select value={approveTableId} onValueChange={setApproveTableId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTables.map((t) => {
                        const currentId = approveBooking.table?.id || approveBooking.tableId;
                        const isCurrent = t.id === currentId;
                        const fits = t.seats >= approveBooking.guestCount;
                        return (
                          <SelectItem key={t.id} value={t.id}>
                            Table {t.tableNumber} ({t.seats} seats)
                            {isCurrent ? " — current" : ""}
                            {!fits ? " — too small!" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Note to guest (optional)</Label>
                <Textarea
                  placeholder="e.g., We moved you to a cosier table!"
                  value={approveAdminNote}
                  onChange={(e) => setApproveAdminNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveBooking(null)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={!approveTableId || actionLoading === approveBooking?.id}
            >
              {actionLoading === approveBooking?.id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Approve Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectId} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Please provide a reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || actionLoading === rejectId}
            >
              {actionLoading === rejectId ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Reject Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
