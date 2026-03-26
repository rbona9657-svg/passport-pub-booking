"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Clock, Users, Check, X, MessageSquare, Loader2, Mic } from "lucide-react";
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
  table: { tableNumber: string; seats: number };
  user: { name: string | null; email: string } | null;
}

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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
    const interval = setInterval(fetchBookings, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchBookings]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/bookings/${id}/approve`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.emailSent) {
          toast({ title: "Booking Approved", description: "Confirmation email sent to the guest." });
        } else {
          toast({
            title: "Booking Approved",
            description: `Warning: ${data.emailError || "Confirmation email could not be sent."}`,
            variant: "destructive",
          });
        }
        setBookings((prev) => prev.filter((b) => b.id !== id));
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

  const pendingCount = bookings.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Manage incoming booking requests</p>
      </div>

      {/* Quick Actions */}
      <div>
        <Link href="/admin/mobile/voice-book">
          <Button size="lg" className="gap-2">
            <Mic className="h-5 w-5" />
            Voice Booking
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
            {bookings.map((booking) => (
              <Card key={booking.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{booking.reservationName}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{booking.guestEmail || booking.user?.email || "No email"}</p>
                    </div>
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                      Pending
                    </Badge>
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
                      Table {booking.table.tableNumber}
                    </div>
                  </div>

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
                      onClick={() => handleApprove(booking.id)}
                      disabled={actionLoading === booking.id}
                    >
                      {actionLoading === booking.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </>
                      )}
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
            ))}
          </div>
        )}
      </div>

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
