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

    // Send rejection email and track result
    const email = booking.user?.email || booking.guestEmail;
    let emailSent = false;
    let emailError: string | null = null;

    if (email) {
      try {
        await sendBookingRejected(
          email,
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
        );
        emailSent = true;
      } catch (err) {
        console.error("Failed to send rejection email:", err);
        emailError = err instanceof Error ? err.message : "Failed to send email";
      }
    } else {
      emailError = "No email address found for this booking";
    }

    return NextResponse.json({ ...updated, emailSent, emailError });
  } catch (error) {
    console.error("Error rejecting booking:", error);
    return NextResponse.json({ error: "Failed to reject booking" }, { status: 500 });
  }
}
