"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Search, Loader2, XCircle, CalendarDays, Clock, Users, MapPin } from "lucide-react";

interface BookingResult {
  id: string;
  reservationName: string;
  guestCount: number;
  guestEmail: string | null;
  bookingDate: string;
  arrivalTime: string;
  departureTime: string;
  status: string;
  comment: string | null;
  table: { tableNumber: string; seats: number };
}

export default function CancelPage() {
  const [email, setEmail] = useState("");
  const [bookings, setBookings] = useState<BookingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSearched(false);
    try {
      const res = await fetch(`/api/bookings/lookup?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      } else {
        setBookings([]);
      }
      setSearched(true);
    } catch {
      toast({ title: "Error", description: "Failed to look up bookings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (bookingId: string) => {
    setCancelling(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status: "cancelled" } : b))
        );
        toast({ title: "Booking cancelled", description: "You'll receive a confirmation email." });
      } else {
        const data = await res.json();
        toast({
          title: "Failed to cancel",
          description: data.error || "Please try again",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    } finally {
      setCancelling(null);
    }
  };

  const statusLabel: Record<string, { text: string; color: string }> = {
    pending: { text: "Waiting for Approval", color: "text-yellow-500" },
    approved: { text: "Confirmed", color: "text-green-500" },
    rejected: { text: "Rejected", color: "text-red-500" },
    cancelled: { text: "Cancelled", color: "text-gray-500" },
  };

  const activeBookings = bookings.filter((b) => b.status === "pending" || b.status === "approved");
  const pastBookings = bookings.filter((b) => b.status === "rejected" || b.status === "cancelled");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Manage Your Bookings</h1>
          <p className="text-muted-foreground mt-1">
            Enter your email to view and cancel your reservations
          </p>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="lookup-email" className="sr-only">Email</Label>
                <Input
                  id="lookup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your booking email..."
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                {loading ? "" : "Find"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {searched && bookings.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/no-bookings.svg" alt="" className="mx-auto mb-4 h-28 w-28 opacity-70" />
              <h3 className="text-base font-semibold">No Bookings Found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                We couldn't find any bookings for this email address.
              </p>
            </CardContent>
          </Card>
        )}

        {activeBookings.length > 0 && (
          <div className="space-y-4 mb-6">
            <h2 className="text-lg font-semibold">Active Bookings</h2>
            {activeBookings.map((booking) => (
              <Card key={booking.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{booking.reservationName}</CardTitle>
                      <CardDescription className={statusLabel[booking.status]?.color}>
                        {statusLabel[booking.status]?.text}
                      </CardDescription>
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
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      Table {booking.table.tableNumber}
                    </div>
                  </div>
                  {booking.comment && (
                    <p className="text-xs text-muted-foreground italic">"{booking.comment}"</p>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => handleCancel(booking.id)}
                    disabled={cancelling === booking.id}
                  >
                    {cancelling === booking.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Cancel Booking
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {pastBookings.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-muted-foreground">Past Bookings</h2>
            {pastBookings.map((booking) => (
              <Card key={booking.id} className="opacity-60">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{booking.reservationName}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.bookingDate} {booking.arrivalTime} - Table {booking.table.tableNumber}
                      </p>
                    </div>
                    <span className={`text-xs font-medium ${statusLabel[booking.status]?.color}`}>
                      {statusLabel[booking.status]?.text}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
