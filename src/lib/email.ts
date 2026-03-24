import { sendEmail } from "@/lib/gmail";

const appUrl = process.env.NEXTAUTH_URL || "https://passport-pub-booking-production.up.railway.app";

interface BookingEmailData {
  reservationName: string;
  bookingDate: string;
  arrivalTime: string;
  departureTime: string;
  guestCount: number;
  tableNumber: string;
  comment?: string | null;
}

function emailWrapper(content: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-size: 28px; font-weight: 700; color: #1a1a2e; margin: 0;">Passport Pub</h1>
        <div style="width: 60px; height: 3px; background: #3b4fd4; margin: 12px auto;"></div>
      </div>
      ${content}
      <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 13px; margin: 0;">Passport Pub | Budapest</p>
      </div>
    </div>
  `;
}

function bookingDetailsBlock(data: BookingEmailData) {
  return `
    <div style="background: #f1f5f9; border-radius: 10px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #64748b; font-size: 14px;">Name</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1e293b;">${data.reservationName}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b; font-size: 14px;">Date</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1e293b;">${data.bookingDate}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b; font-size: 14px;">Time</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1e293b;">${data.arrivalTime} - ${data.departureTime}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b; font-size: 14px;">Guests</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1e293b;">${data.guestCount}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b; font-size: 14px;">Table</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1e293b;">${data.tableNumber}</td></tr>
        ${data.comment ? `<tr><td style="padding: 6px 0; color: #64748b; font-size: 14px;">Note</td><td style="padding: 6px 0; text-align: right; color: #475569; font-style: italic;">${data.comment}</td></tr>` : ""}
      </table>
    </div>
  `;
}

export async function sendBookingPending(to: string, data: BookingEmailData) {
  return sendEmail(
    to,
    "Booking Received - Passport Pub",
    emailWrapper(`
      <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
        <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 8px;">Booking Received!</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Thank you for your reservation request. We'll review it and get back to you shortly.
        </p>
        ${bookingDetailsBlock(data)}
        <p style="color: #64748b; font-size: 14px; margin: 16px 0 0;">
          You'll receive an email once your booking is confirmed.
        </p>
      </div>
    `),
  );
}

export async function sendAdminNewBooking(bookingId: string, data: BookingEmailData, guestEmail: string) {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  if (adminEmails.length === 0) return;

  const approveUrl = `${appUrl}/api/bookings/${bookingId}/approve?token=${process.env.ADMIN_SETUP_TOKEN}`;

  return sendEmail(
    adminEmails,
    `New Booking: ${data.reservationName} - ${data.bookingDate} ${data.arrivalTime}`,
    emailWrapper(`
      <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
        <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 8px;">New Booking Request</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
          A new table reservation has been submitted and is waiting for your approval.
        </p>
        <p style="color: #475569; font-size: 14px; margin: 0 0 16px;">
          Guest email: <strong>${guestEmail}</strong>
        </p>
        ${bookingDetailsBlock(data)}
        <div style="text-align: center; margin-top: 24px;">
          <a href="${approveUrl}" style="display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">Approve Booking</a>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">
          Or manage all bookings in the <a href="${appUrl}/setup" style="color: #3b4fd4;">admin panel</a>.
        </p>
      </div>
    `),
  );
}

export async function sendBookingApproved(to: string, data: BookingEmailData) {
  return sendEmail(
    to,
    "Booking Confirmed! - Passport Pub",
    emailWrapper(`
      <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="display: inline-block; background: #dcfce7; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 28px;">&#10003;</div>
        </div>
        <h2 style="color: #16a34a; font-size: 22px; margin: 0 0 8px; text-align: center;">Booking Confirmed!</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px; text-align: center;">
          Great news! Your table is reserved. We're looking forward to seeing you!
        </p>
        ${bookingDetailsBlock(data)}
        <div style="text-align: center; margin-top: 20px;">
          <p style="color: #475569; font-size: 15px; font-weight: 600;">See you at Passport Pub!</p>
        </div>
      </div>
    `),
  );
}

export async function sendBookingRejected(to: string, data: BookingEmailData, reason: string) {
  return sendEmail(
    to,
    "Booking Update - Passport Pub",
    emailWrapper(`
      <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
        <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 8px;">Booking Update</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Unfortunately, we couldn't accommodate your reservation at this time.
        </p>
        ${bookingDetailsBlock(data)}
        <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="color: #991b1b; font-size: 14px; margin: 0;"><strong>Reason:</strong> ${reason}</p>
        </div>
        <p style="color: #475569; font-size: 14px; margin: 16px 0 0;">
          Please try booking a different time or table. We'd love to have you!
        </p>
      </div>
    `),
  );
}

export async function sendBookingCancelled(guestEmail: string, data: BookingEmailData) {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);

  // Notify admins
  if (adminEmails.length > 0) {
    sendEmail(
      adminEmails,
      `Booking Cancelled: ${data.reservationName} - ${data.bookingDate}`,
      emailWrapper(`
        <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
          <h2 style="color: #dc2626; font-size: 20px; margin: 0 0 8px;">Booking Cancelled</h2>
          <p style="color: #475569; font-size: 15px; margin: 0 0 16px;">
            The following booking has been cancelled by the guest (<strong>${guestEmail}</strong>):
          </p>
          ${bookingDetailsBlock(data)}
        </div>
      `),
    ).catch(console.error);
  }

  // Confirm cancellation to guest
  return sendEmail(
    guestEmail,
    "Booking Cancelled - Passport Pub",
    emailWrapper(`
      <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
        <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 8px;">Booking Cancelled</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Your reservation has been cancelled. We hope to see you another time!
        </p>
        ${bookingDetailsBlock(data)}
        <div style="text-align: center; margin-top: 20px;">
          <a href="${appUrl}/book" style="display: inline-block; background: #3b4fd4; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">Book Again</a>
        </div>
      </div>
    `),
  );
}
