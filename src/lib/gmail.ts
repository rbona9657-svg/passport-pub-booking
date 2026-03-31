import { google } from "googleapis";

function getAuth() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    const missing = [
      !clientId && "GMAIL_CLIENT_ID",
      !clientSecret && "GMAIL_CLIENT_SECRET",
      !refreshToken && "GMAIL_REFRESH_TOKEN",
    ].filter(Boolean);
    throw new Error(`Gmail OAuth2 config missing: ${missing.join(", ")}`);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "https://developers.google.com/oauthplayground"
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

function createRawEmail(to: string | string[], subject: string, html: string): string {
  const sender = process.env.GMAIL_SENDER || "rbona9657@gmail.com";
  const toList = Array.isArray(to) ? to.join(", ") : to;

  const messageParts = [
    `From: "Passport Pub" <${sender}>`,
    `To: ${toList}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ];

  const message = messageParts.join("\r\n");
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string
): Promise<void> {
  const toStr = Array.isArray(to) ? to.join(", ") : to;
  console.log(`[Email] Sending to: ${toStr}, subject: "${subject}"`);

  try {
    const auth = getAuth();
    const gmail = google.gmail({ version: "v1", auth });
    const raw = createRawEmail(to, subject, html);

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });
    console.log(`[Email] Sent successfully to: ${toStr}`);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errCode = (error as { code?: number })?.code;
    console.error(`[Email] FAILED to send to ${toStr}:`, {
      message: errMsg,
      code: errCode,
      hint: errCode === 401 || errMsg.includes("invalid_grant")
        ? "REFRESH TOKEN EXPIRED — regenerate at https://developers.google.com/oauthplayground"
        : undefined,
    });
    throw error;
  }
}

/** Quick health check — verifies OAuth2 credentials can obtain an access token. */
export async function checkEmailHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const auth = getAuth();
    await auth.getAccessToken();
    return { ok: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, error: msg };
  }
}
