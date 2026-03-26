"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Clock, Users, Search, Loader2, Ban } from "lucide-react";
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
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  approved: "bg-green-500/10 text-green-600 border-green-500/30",
  rejected: "bg-red-500/10 text-red-600 border-red-500/30",
  cancelled: "bg-gray-500/10 text-gray-500 border-gray-500/30",
};

export default function AllBookingsPage() {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCancel = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/bookings/${id}/admin-cancel`, { method: "POST" });
      if (res.ok) {
        toast({ title: "Booking cancelled" });
        fetchBookings();
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (dateFilter) params.set("date", dateFilter);
      const res = await fetch(`/api/bookings?${params}`);
      if (res.ok) setBookings(await res.json());
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const filtered = bookings.filter((b) =>
    search ? b.reservationName.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">All Bookings</h1>
        <p className="text-muted-foreground">View and search all booking records</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full sm:w-44"
          />
          {dateFilter && (
            <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setDateFilter("")}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No bookings found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((booking) => (
            <Card key={booking.id}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{booking.reservationName}</p>
                  <p className="text-xs text-muted-foreground truncate">{booking.user?.email || booking.guestEmail || "No email"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {booking.bookingDate}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {booking.arrivalTime}-{booking.departureTime}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {booking.guestCount}
                  </span>
                  <span className="font-medium text-foreground">T{booking.table.tableNumber}</span>
                  <Badge variant="outline" className={statusColors[booking.status] || ""}>
                    {booking.status}
                  </Badge>
                  {booking.createdByAdmin && (
                    <Badge variant="secondary" className="text-xs">Admin</Badge>
                  )}
                  {(booking.status === "approved" || booking.status === "pending") && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      onClick={() => handleCancel(booking.id)}
                      disabled={actionLoading === booking.id}
                    >
                      {actionLoading === booking.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Ban className="h-3 w-3 mr-1" />
                      )}
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
