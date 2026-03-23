import webpush from "web-push";
import { db } from "@/lib/db";
import { pushSubscriptions, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

let pushConfigured = false;
try {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (subject && publicKey && privateKey && !publicKey.startsWith("PLACEHOLDER")) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    pushConfigured = true;
  }
} catch {
  console.warn("Web push not configured - VAPID keys missing or invalid");
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendPushToAdmins(payload: PushPayload) {
  if (!pushConfigured) return { sent: 0, total: 0 };
  try {
    const adminSubs = await db
      .select({
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        authKey: pushSubscriptions.authKey,
        subId: pushSubscriptions.id,
      })
      .from(pushSubscriptions)
      .innerJoin(users, eq(users.id, pushSubscriptions.userId))
      .where(eq(users.role, "admin"));

    const results = await Promise.allSettled(
      adminSubs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.authKey },
            },
            JSON.stringify(payload)
          );
        } catch (error: unknown) {
          if (error && typeof error === "object" && "statusCode" in error && (error as { statusCode: number }).statusCode === 410) {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.subId));
          }
          throw error;
        }
      })
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return { sent, total: adminSubs.length };
  } catch (error) {
    console.error("Failed to send push notifications:", error);
    return { sent: 0, total: 0 };
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!pushConfigured) return;
  try {
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.authKey },
            },
            JSON.stringify(payload)
          );
        } catch (error: unknown) {
          if (error && typeof error === "object" && "statusCode" in error && (error as { statusCode: number }).statusCode === 410) {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          }
        }
      })
    );
  } catch (error) {
    console.error("Failed to send push to user:", error);
  }
}
