import { NextRequest, NextResponse } from "next/server";
import { getBookingById, updateBookingStatus } from "@/lib/db/queries/bookings";
import { rejectBookingSchema } from "@/lib/validations";
import { sendBookingRejected } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = rejectBookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const booking = await getBookingById(id);

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status !== "pending") {
      return NextResponse.json(
        { error: "Can only reject pending bookings" },
        { status: 400 }
      );
    }

    const updated = await updateBookingStatus(id, "rejected", parsed.data.reason);

    // Send rejection email (non-blocking)
    if (booking.user?.email) {
      sendBookingRejected(
        booking.user.email,
        {
          reservationName: booking.reservationName,
          bookingDate: booking.bookingDate,
          arrivalTime: booking.arrivalTime,
          departureTime: booking.departureTime,
          guestCount: booking.guestCount,
          tableNumber: booking.table?.tableNumber ?? "N/A",
          comment: booking.comment,
        },
        parsed.data.reason
      ).catch(console.error);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error rejecting booking:", error);
    return NextResponse.json({ error: "Failed to reject booking" }, { status: 500 });
  }
}
