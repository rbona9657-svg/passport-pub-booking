import { NextRequest, NextResponse } from "next/server";
import { getBookingById, updateBookingStatus } from "@/lib/db/queries/bookings";
import { sendBookingApproved } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const booking = await getBookingById(id);

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status !== "pending") {
      return NextResponse.json(
        { error: "Can only approve pending bookings" },
        { status: 400 }
      );
    }

    const updated = await updateBookingStatus(id, "approved");

    // Send approval email (non-blocking)
    if (booking.user?.email) {
      sendBookingApproved(booking.user.email, {
        reservationName: booking.reservationName,
        bookingDate: booking.bookingDate,
        arrivalTime: booking.arrivalTime,
        departureTime: booking.departureTime,
        guestCount: booking.guestCount,
        tableNumber: booking.table?.tableNumber ?? "N/A",
        comment: booking.comment,
      }).catch(console.error);
    }

    // Send push to user (non-blocking)
    if (booking.userId) sendPushToUser(booking.userId, {
      title: "Booking Confirmed!",
      body: `Your table at Passport Pub on ${booking.bookingDate} is confirmed!`,
      url: "/my-bookings",
    }).catch(console.error);


    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error approving booking:", error);
    return NextResponse.json({ error: "Failed to approve booking" }, { status: 500 });
  }
}
