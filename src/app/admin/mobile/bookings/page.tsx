"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays,
  Clock,
  Users,
  Loader2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

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
  createdByAdmin: boolean;
  table: { tableNumber: string; seats: number };
  user: { name: string | null; email: string } | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  approved: "bg-green-500/10 text-green-500 border-green-500/30",
  rejected: "bg-red-500/10 text-red-500 border-red-500/30",
  cancelled: "bg-gray-500/10 text-gray-500 border-gray-500/30",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
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
    // Handle post-midnight (00-05 should come after 23)
    const aAdj = aNum < 600 ? aNum + 2400 : aNum;
    const bAdj = bNum < 600 ? bNum + 2400 : bNum;
    return aAdj - bAdj;
  });
}

export default function MobileBookingsPage() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings?date=${date}`);
      if (res.ok) setBookings(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchBookings();
    // Auto-refresh every 30s
    const interval = setInterval(fetchBookings, 30000);
    return () => clearInterval(interval);
  }, [fetchBookings]);

  const changeDate = (offset: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + offset);
    setDate(d.toISOString().split("T")[0]);
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/bookings/${id}/approve`, { method: "POST" });
      if (res.ok) {
        toast({ title: "Booking approved" });
        fetchBookings();
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/bookings/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Rejected via mobile admin" }),
      });
      if (res.ok) {
        toast({ title: "Booking rejected" });
        fetchBookings();
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const grouped = groupByTime(bookings);
  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const approvedCount = bookings.filter((b) => b.status === "approved").length;

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} className="h-9 w-9">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "date";
              input.value = date;
              input.onchange = (e) => setDate((e.target as HTMLInputElement).value);
              input.showPicker?.();
              input.click();
            }}
            className="text-lg font-semibold hover:text-primary transition-colors"
          >
            {date === today ? "Today" : formatDate(date)}
          </button>
          <p className="text-xs text-muted-foreground">
            {date !== today && date} {pendingCount > 0 && `\u00B7 ${pendingCount} pending`}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => changeDate(1)} className="h-9 w-9">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2">
        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
          {approvedCount} confirmed
        </Badge>
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
          {pendingCount} pending
        </Badge>
        <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={fetchBookings}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Bookings list */}
      {loading && bookings.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarDays className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No bookings for this day</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(([time, items]) => (
            <div key={time}>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">{time}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-2">
                {items.map((booking) => (
                  <Card
                    key={booking.id}
                    className="overflow-hidden"
                  >
                    <CardContent className="p-3">
                      <button
                        className="w-full text-left"
                        onClick={() => setExpandedId(expandedId === booking.id ? null : booking.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium text-sm truncate">
                              {booking.reservationName}
                            </span>
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
                      </button>

                      {/* Expanded details */}
                      {expandedId === booking.id && (
                        <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                          {booking.guestEmail && (
                            <p className="text-xs text-muted-foreground">
                              Email: {booking.user?.email || booking.guestEmail}
                            </p>
                          )}
                          {booking.comment && (
                            <p className="text-xs text-muted-foreground">
                              Note: {booking.comment}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Table seats: {booking.table.seats}
                          </p>

                          {booking.status === "pending" && (
                            <div className="flex gap-2 pt-1">
                              <Button
                                size="sm"
                                className="flex-1 h-9"
                                onClick={(e) => { e.stopPropagation(); handleApprove(booking.id); }}
                                disabled={actionLoading === booking.id}
                              >
                                {actionLoading === booking.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <><Check className="h-4 w-4 mr-1" /> Approve</>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="flex-1 h-9"
                                onClick={(e) => { e.stopPropagation(); handleReject(booking.id); }}
                                disabled={actionLoading === booking.id}
                              >
                                <X className="h-4 w-4 mr-1" /> Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
