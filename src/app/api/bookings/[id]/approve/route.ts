import { NextRequest, NextResponse } from "next/server";
import { getBookingById, updateBookingStatus } from "@/lib/db/queries/bookings";
import { sendBookingApproved } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { db } from "@/lib/db";
import { tables } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function handleApproval(id: string, newTableId?: string, adminNote?: string) {
  const booking = await getBookingById(id);

  if (!booking) {
    return { error: "Booking not found", status: 404 };
  }

  if (booking.status !== "pending") {
    return { error: "This booking has already been processed", status: 400 };
  }

  // If admin is reassigning to a different table, verify it exists
  let finalTableNumber = booking.table?.tableNumber ?? "N/A";
  const tableChanged = newTableId && newTableId !== booking.tableId;

  if (tableChanged) {
    const [newTable] = await db
      .select()
      .from(tables)
      .where(eq(tables.id, newTableId))
      .limit(1);
    if (!newTable) {
      return { error: "New table not found", status: 404 };
    }
    finalTableNumber = newTable.tableNumber;
  }

  await updateBookingStatus(id, "approved", adminNote, tableChanged ? newTableId : undefined);

  // Send approval email and track result
  // Prefer guestEmail (explicitly provided for notifications) over user account email
  // (which may be the admin's email if booking was created by admin)
  const email = booking.guestEmail || booking.user?.email;
  let emailSent = false;
  let emailError: string | null = null;

  if (email) {
    const fullComment = [booking.comment, adminNote, tableChanged ? `Table reassigned to ${finalTableNumber}` : ""]
      .filter(Boolean)
      .join(" | ") || null;

    try {
      await sendBookingApproved(email, {
        reservationName: booking.reservationName,
        bookingDate: booking.bookingDate,
        arrivalTime: booking.arrivalTime,
        departureTime: booking.departureTime,
        guestCount: booking.guestCount,
        tableNumber: finalTableNumber,
        comment: fullComment,
        adminNote: adminNote || undefined,
        tableChanged: !!tableChanged,
        originalTableNumber: tableChanged ? (booking.table?.tableNumber ?? "N/A") : undefined,
      });
      emailSent = true;
    } catch (err) {
      console.error("Failed to send approval email:", err);
      emailError = err instanceof Error ? err.message : "Failed to send email";
    }
  } else {
    emailError = "No email address found for this booking";
  }

  // Send push to user (non-blocking)
  if (booking.userId) {
    sendPushToUser(booking.userId, {
      title: "Booking Confirmed!",
      body: `Your table at Passport Pub on ${booking.bookingDate} is confirmed!${tableChanged ? ` (Table ${finalTableNumber})` : ""}`,
      url: "/my-bookings",
    }).catch(console.error);
  }

  return { booking, status: 200, emailSent, emailError };
}

// POST - from admin panel
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let newTableId: string | undefined;
    let adminNote: string | undefined;

    try {
      const body = await req.json();
      newTableId = body.newTableId;
      adminNote = body.adminNote;
    } catch {
      // No body is fine — simple approve without reassignment
    }

    const result = await handleApproval(id, newTableId, adminNote);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      ...result.booking,
      emailSent: result.emailSent,
      emailError: result.emailError,
    });
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
