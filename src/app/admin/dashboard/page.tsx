"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CalendarDays, Clock, Users, Check, X, MessageSquare, Loader2, Mic, CalendarPlus, AlertTriangle, ArrowRight, Lightbulb } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

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
  table: { id?: string; tableNumber: string; seats: number };
  user: { name: string | null; email: string } | null;
}

interface AvailableTable {
  id: string;
  tableNumber: string;
  seats: number;
}

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [approveBooking, setApproveBooking] = useState<BookingWithDetails | null>(null);
  const [approveTableId, setApproveTableId] = useState<string>("");
  const [approveAdminNote, setApproveAdminNote] = useState("");
  const [availableTables, setAvailableTables] = useState<AvailableTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  // Per-card inline table reassignment
  const [cardTableOverrides, setCardTableOverrides] = useState<Record<string, string>>({});
  const [expandedReassign, setExpandedReassign] = useState<string | null>(null);
  const [cardAvailableTables, setCardAvailableTables] = useState<Record<string, AvailableTable[]>>({});
  const { toast } = useToast();

  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings?status=pending");
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load bookings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 30000);
    return () => clearInterval(interval);
  }, [fetchBookings]);

  const fetchAvailableTables = async (booking: BookingWithDetails) => {
    setTablesLoading(true);
    try {
      // Get floor plan with all tables
      const fpRes = await fetch("/api/floor-plan");
      if (!fpRes.ok) return;
      const fpData = await fpRes.json();
      const floorPlanId = fpData.id;

      const allTables: AvailableTable[] = (fpData.tables || []).map((t: { id: string; tableNumber: string; seats: number }) => ({
        id: t.id,
        tableNumber: t.tableNumber,
        seats: t.seats,
      }));

      // Get availability for this date/time
      const res = await fetch(
        `/api/tables/availability?floorPlanId=${floorPlanId}&date=${booking.bookingDate}&arrival=${booking.arrivalTime}&departure=${booking.departureTime}`
      );
      if (!res.ok) return;
      const statusMap = await res.json();

      // Filter to available tables + the currently assigned table
      const currentTableId = booking.table?.id || booking.tableId;
      const available = allTables.filter(
        (t) => statusMap[t.id] === "available" || t.id === currentTableId
      );
      // Sort by best-fit: closest seats >= guestCount first
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
      // Silently fail — admin can still approve without changing table
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
    // Use card-level override if admin already picked a table on the card
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
        setBookings((prev) => prev.filter((b) => b.id !== id));
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
        setBookings((prev) => prev.filter((b) => b.id !== rejectId));
      }
    } catch {
      toast({ title: "Error", description: "Failed to reject", variant: "destructive" });
    } finally {
      setActionLoading(null);
      setRejectId(null);
      setRejectReason("");
    }
  };

  // Detect merged table groups by [GROUP:uuid] tag in comments
  const extractGroupId = (comment: string | null): string | null => {
    if (!comment) return null;
    const match = comment.match(/\[GROUP:([a-f0-9-]+)\]/);
    return match ? match[1] : null;
  };

  const groupCounts = bookings.reduce<Record<string, number>>((acc, b) => {
    const gid = extractGroupId(b.comment);
    if (gid) acc[gid] = (acc[gid] || 0) + 1;
    return acc;
  }, {});

  const getGroupIndex = (booking: BookingWithDetails): { groupId: string; index: number; total: number } | null => {
    const gid = extractGroupId(booking.comment);
    if (!gid || !groupCounts[gid] || groupCounts[gid] < 2) return null;
    const groupBookings = bookings.filter((b) => extractGroupId(b.comment) === gid);
    const idx = groupBookings.findIndex((b) => b.id === booking.id);
    return { groupId: gid, index: idx + 1, total: groupCounts[gid] };
  };

  const pendingCount = bookings.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Manage incoming booking requests</p>
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
      </div>

      {/* Pending Bookings */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Pending Bookings</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : bookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No pending bookings</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bookings.map((booking) => {
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
              {/* Current booking info */}
              <div className="text-sm space-y-1">
                <p><strong>{approveBooking.reservationName}</strong> — {approveBooking.guestCount} guests</p>
                <p className="text-muted-foreground">{approveBooking.bookingDate} &middot; {approveBooking.arrivalTime}–{approveBooking.departureTime}</p>
              </div>

              {/* Current table utilization */}
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

              {/* Best-fit suggestion */}
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

              {/* Table reassignment dropdown */}
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

              {/* Admin note to guest */}
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
