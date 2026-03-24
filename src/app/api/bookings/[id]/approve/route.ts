import { NextRequest, NextResponse } from "next/server";
import { getBookingById, updateBookingStatus } from "@/lib/db/queries/bookings";
import { sendBookingApproved } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";

async function handleApproval(id: string) {
  const booking = await getBookingById(id);

  if (!booking) {
    return { error: "Booking not found", status: 404 };
  }

  if (booking.status !== "pending") {
    return { error: "This booking has already been processed", status: 400 };
  }

  await updateBookingStatus(id, "approved");

  // Send approval email (non-blocking)
  const email = booking.user?.email || booking.guestEmail;
  if (email) {
    sendBookingApproved(email, {
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
  if (booking.userId) {
    sendPushToUser(booking.userId, {
      title: "Booking Confirmed!",
      body: `Your table at Passport Pub on ${booking.bookingDate} is confirmed!`,
      url: "/my-bookings",
    }).catch(console.error);
  }

  return { booking, status: 200 };
}

// POST - from admin panel
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await handleApproval(id);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.booking);
  } catch (error) {
    console.error("Error approving booking:", error);
    return NextResponse.json({ error: "Failed to approve booking" }, { status: 500 });
  }
}

// GET - from email approve button (token-based)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = req.nextUrl.searchParams.get("token");
    const setupToken = process.env.ADMIN_SETUP_TOKEN;

    if (!setupToken || token !== setupToken) {
      return new NextResponse(
        `<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;background:#0f172a;color:white;">
          <div style="text-align:center;"><h1 style="color:#ef4444;">Unauthorized</h1><p>Invalid approval token.</p></div>
        </body></html>`,
        { status: 401, headers: { "Content-Type": "text/html" } }
      );
    }

    const result = await handleApproval(id);

    if (result.error) {
      return new NextResponse(
        `<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;background:#0f172a;color:white;">
          <div style="text-align:center;"><h1 style="color:#f59e0b;">${result.error}</h1><p>This booking may have already been approved or cancelled.</p></div>
        </body></html>`,
        { status: result.status, headers: { "Content-Type": "text/html" } }
      );
    }

    const appUrl = process.env.NEXTAUTH_URL || "https://passport-pub-booking-production.up.railway.app";
    return new NextResponse(
      `<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;background:#0f172a;color:white;">
        <div style="text-align:center;">
          <div style="font-size:64px;margin-bottom:16px;">&#10003;</div>
          <h1 style="color:#22c55e;font-size:28px;">Booking Approved!</h1>
          <p style="color:#94a3b8;margin-top:8px;">The guest has been notified by email.</p>
          <a href="${appUrl}/setup" style="display:inline-block;margin-top:24px;background:#3b4fd4;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Go to Admin Panel</a>
        </div>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  } catch (error) {
    console.error("Error approving booking:", error);
    return new NextResponse(
      `<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;background:#0f172a;color:white;">
        <div style="text-align:center;"><h1 style="color:#ef4444;">Error</h1><p>Something went wrong. Please try again.</p></div>
      </body></html>`,
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
