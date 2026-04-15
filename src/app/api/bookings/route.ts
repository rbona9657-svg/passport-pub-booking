import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createBooking, getAdminBookings, getUserBookings, getExistingBookingsForEmail } from "@/lib/db/queries/bookings";
import { createBookingSchema, createBookingAdminSchema, toMinutesSinceOpen } from "@/lib/validations";
import { db } from "@/lib/db";
import { tables } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendPushToAdmins } from "@/lib/push";
import { sendBookingPending, sendAdminNewBooking } from "@/lib/email";
import { getLocalToday, isValidPubHour } from "@/lib/constants";

// Simple in-memory rate limiting: max 5 bookings per IP per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

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
    // Rate limit check
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many booking requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();

    // Check if admin — session before parse (remote pattern)
    const session = await auth();
    const isAdmin = session?.user?.role === "admin";

    const schema = isAdmin ? createBookingAdminSchema : createBookingSchema;

    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { tableId, reservationName, guestCount, bookingDate, arrivalTime, departureTime, comment } = parsed.data;
    const guestEmail = parsed.data.guestEmail || null;

    // Only auto-approve if explicitly requested from admin booking pages
    const adminAutoApprove = isAdmin && body.adminAutoApprove === true;

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
    const today = getLocalToday();
    if (bookingDate < today) {
      return NextResponse.json({ error: "Cannot book for a past date" }, { status: 400 });
    }

    // Validate departure is after arrival (accounting for midnight crossing)
    if (arrivalTime === departureTime) {
      return NextResponse.json({ error: "Departure time must be different from arrival time" }, { status: 400 });
    }

    // Validate times fall within opening hours for the booking day
    const bookingDayOfWeek = new Date(bookingDate + "T12:00:00").getDay();
    if (!isValidPubHour(arrivalTime, bookingDayOfWeek)) {
      return NextResponse.json(
        { error: "Az érkezési idő a nyitvatartási időn kívül esik ezen a napon." },
        { status: 400 }
      );
    }
    if (!isValidPubHour(departureTime, bookingDayOfWeek)) {
      return NextResponse.json(
        { error: "A távozási idő a nyitvatartási időn kívül esik ezen a napon." },
        { status: 400 }
      );
    }

    // Check for existing bookings with same email on the same date
    if (guestEmail) {
      const existingBookings = await getExistingBookingsForEmail(guestEmail, bookingDate);
      if (existingBookings.length > 0) {
        // Check for time overlaps using midnight-aware comparison
        const hasTimeOverlap = existingBookings.some((b) => {
          const bFrom = toMinutesSinceOpen(b.arrivalTime);
          const bTo   = toMinutesSinceOpen(b.departureTime);
          const nFrom = toMinutesSinceOpen(arrivalTime);
          const nTo   = toMinutesSinceOpen(departureTime);
          return bFrom < nTo && nFrom < bTo;
        });

        return NextResponse.json(
          {
            error: "duplicate_booking",
            hasTimeOverlap,
            existingBookings: existingBookings.map((b) => ({
              id: b.id,
              arrivalTime: b.arrivalTime,
              departureTime: b.departureTime,
              guestCount: b.guestCount,
              status: b.status,
              tableNumber: b.table.tableNumber,
            })),
            bookingDate,
          },
          { status: 409 }
        );
      }
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
      createdByAdmin: adminAutoApprove,
      status: adminAutoApprove ? "approved" : "pending",
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
