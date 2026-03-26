import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBookingById, updateBookingStatus } from "@/lib/db/queries/bookings";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const booking = await getBookingById(id);

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status === "cancelled") {
      return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
    }

    const updated = await updateBookingStatus(id, "cancelled", "Cancelled by admin");
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
  }
}
