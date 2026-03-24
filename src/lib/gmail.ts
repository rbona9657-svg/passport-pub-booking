import { google } from "googleapis";

function getAuth() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
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
