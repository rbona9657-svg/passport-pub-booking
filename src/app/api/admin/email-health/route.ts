import { NextRequest, NextResponse } from "next/server";
import { checkEmailHealth, sendEmail } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const setupToken = process.env.ADMIN_SETUP_TOKEN;

  if (!setupToken || token !== setupToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await checkEmailHealth();

  const config = {
    GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID ? "set" : "MISSING",
    GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET ? "set" : "MISSING",
    GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN ? "set" : "MISSING",
    GMAIL_SENDER: process.env.GMAIL_SENDER || "MISSING (using default)",
    ADMIN_EMAILS: process.env.ADMIN_EMAILS || "MISSING",
  };

  // Optional: send a test email
  const testEmail = req.nextUrl.searchParams.get("test");
  let testResult: { sent: boolean; error?: string } | undefined;

  if (testEmail && health.ok) {
    try {
      await sendEmail(
        testEmail,
        "Test Email - Passport Pub",
        `<div style="font-family: system-ui; padding: 20px;">
          <h2>Email Test Successful!</h2>
          <p>This is a test email from Passport Pub booking system.</p>
          <p>Sent at: ${new Date().toISOString()}</p>
        </div>`
      );
      testResult = { sent: true };
    } catch (err) {
      testResult = { sent: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({
    emailHealth: health,
    config,
    ...(testResult !== undefined ? { testResult } : {}),
  });
}
