import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createBooking, getAdminBookings, getUserBookings } from "@/lib/db/queries/bookings";
import { createBookingSchema, createBookingAdminSchema } from "@/lib/validations";
import { db } from "@/lib/db";
import { tables } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendPushToAdmins } from "@/lib/push";
import { sendBookingPending, sendAdminNewBooking } from "@/lib/email";

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
    const body = await req.json();

    // Check if admin — if so, guestEmail is optional
    const session = await auth();
    const isAdmin = session?.user?.role === "admin";

    const schema = isAdmin ? createBookingAdminSchema : createBookingSchema;

    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { tableId, reservationName, guestCount, bookingDate, arrivalTime, departureTime, comment } = parsed.data;
    const guestEmail = parsed.data.guestEmail || null;

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
        { error: `This table only has ${table.seats} seats but you need ${guestCount}. Please choose a larger table or book additional tables.` },
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
      userId: session?.user?.id || null,
      tableId,
      reservationName,
      guestCount,
      guestEmail,
      bookingDate,
      arrivalTime,
      departureTime,
      comment,
      createdByAdmin: isAdmin,
      status: isAdmin ? "approved" : "pending",
    });

    // Send push notification to admins (non-blocking)
    sendPushToAdmins({
      title: "New Booking Request",
      body: `${reservationName} - Table ${table.tableNumber}, ${bookingDate} ${arrivalTime}-${departureTime}`,
      url: "/admin/dashboard",
      tag: `booking-${booking.id}`,
    }).catch(console.error);

    const emailData = {
      reservationName,
      bookingDate,
      arrivalTime,
      departureTime,
      guestCount,
      tableNumber: table.tableNumber,
      comment,
    };

    // Send emails and track result
    let emailSent = false;
    let emailError: string | null = null;

    if (guestEmail) {
      try {
        await sendBookingPending(guestEmail, emailData);
        emailSent = true;
      } catch (err) {
        console.error("Failed to send pending email:", err);
        emailError = err instanceof Error ? err.message : "Failed to send confirmation email";
      }
      // Admin notification is non-blocking
      sendAdminNewBooking(booking.id, emailData, guestEmail).catch(console.error);
    } else {
      emailError = "No email address provided";
    }

    return NextResponse.json({ ...booking, emailSent, emailError }, { status: 201 });
  } catch (error) {
    console.error("Error creating booking:", error);
    const message = error instanceof Error ? error.message : "Failed to create booking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
