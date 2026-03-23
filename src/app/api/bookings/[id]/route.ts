import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBookingById, updateBooking, updateBookingStatus } from "@/lib/db/queries/bookings";
import { updateBookingSchema } from "@/lib/validations";
import { sendPushToAdmins } from "@/lib/push";
import { db } from "@/lib/db";
import { tables } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const booking = await getBookingById(id);

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Users can only see their own bookings
    if (session.user.role !== "admin" && booking.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json({ error: "Failed to fetch booking" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const booking = await getBookingById(id);

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (session.user.role !== "admin" && booking.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (booking.status !== "pending") {
      return NextResponse.json(
        { error: "Can only modify pending bookings" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = updateBookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Validate guest count against table seats
    if (parsed.data.guestCount) {
      const [table] = await db
        .select()
        .from(tables)
        .where(eq(tables.id, booking.tableId))
        .limit(1);

      if (table && parsed.data.guestCount > table.seats) {
        return NextResponse.json(
          { error: `This table has ${table.seats} seats maximum.` },
          { status: 400 }
        );
      }
    }

    const updated = await updateBooking(id, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating booking:", error);
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const booking = await getBookingById(id);

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (session.user.role !== "admin" && booking.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (booking.status === "cancelled" || booking.status === "rejected") {
      return NextResponse.json({ error: "Booking already cancelled/rejected" }, { status: 400 });
    }

    const updated = await updateBookingStatus(id, "cancelled");

    // Notify admins about cancellation
    sendPushToAdmins({
      title: "Booking Cancelled",
      body: `${booking.reservationName} cancelled Table ${booking.table?.tableNumber}, ${booking.bookingDate}`,
      url: "/admin/dashboard",
    }).catch(console.error);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
  }
}
