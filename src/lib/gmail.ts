import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

function getAuth() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credentials) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");
  }

  const key = JSON.parse(credentials);
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
    subject: process.env.GMAIL_SENDER || "rbona9657@gmail.com", // impersonate this user
  });

  return auth;
}

function createRawEmail(to: string | string[], subject: string, html: string, from?: string): string {
  const sender = from || process.env.GMAIL_SENDER || "rbona9657@gmail.com";
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
  // Base64url encode
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
  try {
    const auth = getAuth();
    const gmail = google.gmail({ version: "v1", auth });
    const raw = createRawEmail(to, subject, html);

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });
  } catch (error) {
    console.error("Gmail API error:", error);
    throw error;
  }
}
