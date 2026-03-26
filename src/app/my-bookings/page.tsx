"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  CalendarDays, Clock, Users, MapPin, Pencil, Trash2,
  Loader2, MessageSquare, AlertTriangle,
} from "lucide-react";

interface BookingWithTable {
  id: string;
  reservationName: string;
  guestCount: number;
  bookingDate: string;
  arrivalTime: string;
  departureTime: string;
  status: string;
  comment: string | null;
  adminNote: string | null;
  createdAt: string;
  table: { tableNumber: string; seats: number };
}

const statusConfig: Record<string, { label: string; class: string }> = {
  pending: { label: "Pending", class: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  approved: { label: "Confirmed", class: "bg-green-500/10 text-green-600 border-green-500/30" },
  rejected: { label: "Rejected", class: "bg-red-500/10 text-red-600 border-red-500/30" },
  cancelled: { label: "Cancelled", class: "bg-gray-500/10 text-gray-500 border-gray-500/30" },
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<BookingWithTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [editBooking, setEditBooking] = useState<BookingWithTable | null>(null);
  const [editGuests, setEditGuests] = useState("");
  const [editComment, setEditComment] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();

  const fetchBookings = async () => {
    try {
      const res = await fetch("/api/bookings");
      if (res.ok) setBookings(await res.json());
    } catch {
      toast({ title: "Error", description: "Failed to load bookings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, []);

  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const upcoming = bookings.filter(
    (b) => b.bookingDate >= today && (b.status === "pending" || b.status === "approved")
  );
  const past = bookings.filter(
    (b) => b.bookingDate < today || b.status === "rejected" || b.status === "cancelled"
  );

  const handleEdit = (booking: BookingWithTable) => {
    setEditBooking(booking);
    setEditGuests(String(booking.guestCount));
    setEditComment(booking.comment || "");
  };

  const handleEditSave = async () => {
    if (!editBooking) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/bookings/${editBooking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestCount: parseInt(editGuests),
          comment: editComment || null,
        }),
      });
      if (res.ok) {
        toast({ title: "Booking updated!" });
        setEditBooking(null);
        fetchBookings();
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/bookings/${cancelId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Booking cancelled" });
        setCancelId(null);
        fetchBookings();
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to cancel", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const BookingCard = ({ booking, showActions }: { booking: BookingWithTable; showActions?: boolean }) => {
    const status = statusConfig[booking.status] || statusConfig.pending;
    return (
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold">{booking.reservationName}</p>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <MapPin className="h-3.5 w-3.5" />
                Table {booking.table.tableNumber}
              </div>
            </div>
            <Badge variant="outline" className={status.class}>{status.label}</Badge>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              {booking.bookingDate}
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {booking.arrivalTime}-{booking.departureTime}
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5 shrink-0" />
              {booking.guestCount} guests
            </div>
          </div>

          {booking.comment && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {booking.comment}
            </div>
          )}

          {booking.status === "rejected" && booking.adminNote && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/5 p-2 text-xs text-red-600">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {booking.adminNote}
            </div>
          )}

          {showActions && booking.status === "pending" && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEdit(booking)}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Modify
              </Button>
              <Button size="sm" variant="destructive" className="flex-1" onClick={() => setCancelId(booking.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
            </div>
          )}
          {showActions && booking.status === "approved" && (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-destructive border-destructive/30"
              onClick={() => setCancelId(booking.id)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Cancel Booking
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-2xl font-bold tracking-tight mb-6">My Bookings</h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : bookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No bookings yet</p>
              <a href="/book">
                <Button>Book a Table</Button>
              </a>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {upcoming.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Upcoming</h2>
                <div className="space-y-3">
                  {upcoming.map((b) => (
                    <BookingCard key={b.id} booking={b} showActions />
                  ))}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 text-muted-foreground">Past</h2>
                <div className="space-y-3">
                  {past.map((b) => (
                    <BookingCard key={b.id} booking={b} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editBooking} onOpenChange={(open) => !open && setEditBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modify Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Number of Guests</Label>
              <Input
                type="number"
                min="1"
                max={editBooking?.table.seats || 20}
                value={editGuests}
                onChange={(e) => setEditGuests(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Max {editBooking?.table.seats} for this table
              </p>
            </div>
            <div className="space-y-2">
              <Label>Comment</Label>
              <Textarea
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBooking(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to cancel this booking? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelId(null)}>Keep Booking</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cancel Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
