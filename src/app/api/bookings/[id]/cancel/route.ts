import { NextRequest, NextResponse } from "next/server";
import { getBookingById, updateBookingStatus } from "@/lib/db/queries/bookings";
import { sendBookingCancelled } from "@/lib/email";
import { sendPushToAdmins } from "@/lib/push";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { email } = body as { email?: string };

    const booking = await getBookingById(id);

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Verify the cancellation request by email
    const bookingEmail = booking.user?.email || booking.guestEmail;
    if (!email || email.toLowerCase() !== bookingEmail?.toLowerCase()) {
      return NextResponse.json(
        { error: "Email does not match the booking" },
        { status: 403 }
      );
    }

    if (booking.status === "cancelled") {
      return NextResponse.json(
        { error: "This booking is already cancelled" },
        { status: 400 }
      );
    }

    if (booking.status === "rejected") {
      return NextResponse.json(
        { error: "This booking was already rejected" },
        { status: 400 }
      );
    }

    const updated = await updateBookingStatus(id, "cancelled");

    // Send cancellation emails (non-blocking)
    if (bookingEmail) {
      sendBookingCancelled(bookingEmail, {
        reservationName: booking.reservationName,
        bookingDate: booking.bookingDate,
        arrivalTime: booking.arrivalTime,
        departureTime: booking.departureTime,
        guestCount: booking.guestCount,
        tableNumber: booking.table?.tableNumber ?? "N/A",
        comment: booking.comment,
      }).catch(console.error);
    }

    // Notify admins via push (non-blocking)
    sendPushToAdmins({
      title: "Booking Cancelled",
      body: `${booking.reservationName} cancelled their booking for ${booking.bookingDate}`,
      url: "/admin/dashboard",
      tag: `cancel-${booking.id}`,
    }).catch(console.error);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
  }
}
