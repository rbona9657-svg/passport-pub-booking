import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createBooking, getAdminBookings, getUserBookings } from "@/lib/db/queries/bookings";
import { createBookingSchema } from "@/lib/validations";
import { db } from "@/lib/db";
import { tables } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendPushToAdmins } from "@/lib/push";
import { sendBookingPending } from "@/lib/email";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const isAdmin = session.user.role === "admin";

    if (isAdmin) {
      const filters = {
        status: searchParams.get("status") || undefined,
        date: searchParams.get("date") || undefined,
      };
      const result = await getAdminBookings(filters);
      return NextResponse.json(result);
    } else {
      const result = await getUserBookings(session.user.id);
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required to book a table" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createBookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { tableId, reservationName, guestCount, bookingDate, arrivalTime, departureTime, comment } = parsed.data;

    // Verify table exists and has enough seats
    const [table] = await db
      .select()
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    if (guestCount > table.seats) {
      return NextResponse.json(
        { error: `This table has ${table.seats} seats. Please reduce your guest count or choose a larger table.` },
        { status: 400 }
      );
    }

    // Reject past dates
    const today = new Date().toISOString().split("T")[0];
    if (bookingDate < today) {
      return NextResponse.json({ error: "Cannot book for a past date" }, { status: 400 });
    }

    // Create the booking
    const booking = await createBooking({
      userId: session.user.id,
      tableId,
      reservationName,
      guestCount,
      bookingDate,
      arrivalTime,
      departureTime,
      comment,
    });

    // Send push notification to admins (non-blocking)
    sendPushToAdmins({
      title: "New Booking Request",
      body: `${reservationName} - Table ${table.tableNumber}, ${bookingDate} ${arrivalTime}-${departureTime}`,
      url: "/admin/dashboard",
      tag: `booking-${booking.id}`,
    }).catch(console.error);

    // Send confirmation email (non-blocking)
    if (session.user.email) {
      sendBookingPending(session.user.email, {
        reservationName,
        bookingDate,
        arrivalTime,
        departureTime,
        guestCount,
        tableNumber: table.tableNumber,
        comment,
      }).catch(console.error);
    }

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
